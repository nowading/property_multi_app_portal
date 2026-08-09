package com.portal.analytics.adapters.mlclient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portal.analytics.domain.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLContext;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * HTTP client adapter for calling the ML model container.
 *
 * <p>Uses JDK 21's {@link HttpClient} with explicit connect/read timeouts
 * (Connect: 2s, Read: 5s). Implements a thread-safe circuit breaker.
 * When the ML service is unavailable, the client throws {@link DomainException}
 * instead of returning fallback data.
 *
 * <p>Phase C: when {@code ml.service.trust-store-path} is set, the HTTP
 * client is built with a custom {@link SSLContext} so the self-signed
 * ML certificate is trusted.
 */
@Component
public class MlModelClient implements ModelInferencePort {

    private static final Logger log = LoggerFactory.getLogger(MlModelClient.class);

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(5);

    private static final int FAILURE_THRESHOLD = 3;
    private static final Duration CIRCUIT_OPEN_DURATION = Duration.ofSeconds(30);

    private final String mlServiceUrl;
    private final String internalServiceToken;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    // Thread-safe circuit breaker state
    private final AtomicInteger failureCount = new AtomicInteger(0);
    private final AtomicReference<CircuitState> circuitState = new AtomicReference<>(CircuitState.CLOSED);
    private final AtomicReference<Instant> circuitOpenTime = new AtomicReference<>(null);

    public enum CircuitState {
        CLOSED, OPEN, HALF_OPEN
    }

    @Autowired
    public MlModelClient(
            @Value("${ml.service.url:http://localhost:8000}") String mlServiceUrl,
            @Value("${ml.service.token:}") String internalServiceToken,
            @Value("${ml.service.trust-store-path:}") String trustStorePath,
            @Value("${ml.service.trust-store-password:}") String trustStorePassword,
            ObjectMapper objectMapper
    ) {
        this.mlServiceUrl = mlServiceUrl;
        this.internalServiceToken = internalServiceToken == null ? "" : internalServiceToken;
        this.objectMapper = objectMapper;
        HttpClient.Builder builder = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .version(HttpClient.Version.HTTP_1_1)
                .followRedirects(HttpClient.Redirect.NORMAL);
        SSLContext sslContext = MlTlsContextFactory.build(trustStorePath, trustStorePassword);
        if (sslContext != null) {
            builder.sslContext(sslContext);
            log.info("MlModelClient: SSL context configured from trust store {} "
                    + "(mTLS for backend↔ML traffic)", trustStorePath);
        } else {
            log.info("MlModelClient: no custom trust store — falling back to JVM default");
        }
        this.httpClient = builder.build();
        if (this.internalServiceToken.isEmpty()) {
            log.warn("ml.service.token is not configured; outbound calls to ML container will NOT include x-internal-token header. "
                    + "Set INTERNAL_SERVICE_TOKEN env var to enable service-to-service auth.");
        } else {
            log.info("MlModelClient: x-internal-token header will be attached to outgoing requests (length={})",
                    this.internalServiceToken.length());
        }
    }

    /**
     * Convenience constructor used by unit tests that do not exercise TLS.
     * Falls back to the JVM default trust store (no PKCS#12 configured).
     */
    public MlModelClient(String mlServiceUrl, String internalServiceToken, ObjectMapper objectMapper) {
        this(mlServiceUrl, internalServiceToken, "", "", objectMapper);
    }

    /**
     * Apply the internal service auth header to an outgoing request builder
     * when a token is configured. No-op when the token is empty (dev mode).
     */
    private HttpRequest.Builder applyAuthHeader(HttpRequest.Builder builder) {
        if (!internalServiceToken.isEmpty()) {
            builder.header("x-internal-token", internalServiceToken);
        }
        return builder;
    }

    @Override
    public PredictionResult predict(PropertyFeatures features) {
        if (!checkCircuit()) {
            throw new DomainException("ML service circuit breaker is OPEN, predictions are temporarily unavailable");
        }

        String url = mlServiceUrl + "/predict";
        try {
            Map<String, Object> payload = Map.of("features", toPayload(features));
            String jsonBody = objectMapper.writeValueAsString(payload);
            log.debug("Sending ML predict request to {}: {}", url, jsonBody);

            HttpRequest request = applyAuthHeader(HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(READ_TIMEOUT)
                    .header("Content-Type", "application/json"))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                resetCircuit();
                log.debug("ML predict response: {}", response.body());
                Map<String, Object> result = objectMapper.readValue(response.body(), Map.class);
                double predictedPrice = ((Number) result.get("prediction")).doubleValue();
                return new PredictionResult(predictedPrice, features, Instant.now());
            } else {
                recordFailure();
                log.error("ML service returned status {}: {}", response.statusCode(), response.body());
                throw new DomainException("ML service returned HTTP " + response.statusCode() + ": " + response.body());
            }
        } catch (DomainException e) {
            throw e;
        } catch (Exception e) {
            recordFailure();
            log.error("ML service call failed: {}", e.getMessage());
            throw new DomainException("ML service call failed: " + e.getMessage(), e);
        }
    }

    @Override
    public List<PredictionResult> predictBatch(List<PropertyFeatures> featuresList) {
        return featuresList.stream()
                .map(this::predict)
                .toList();
    }

    @Override
    public ModelInfo getModelInfo() {
        if (!checkCircuit()) {
            throw new DomainException("ML service circuit breaker is OPEN, model info is temporarily unavailable");
        }

        String url = mlServiceUrl + "/model-info";
        try {
            HttpRequest request = applyAuthHeader(HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(READ_TIMEOUT))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                resetCircuit();
                Map<String, Object> result = objectMapper.readValue(response.body(), Map.class);

                String modelType = (String) result.getOrDefault("model_type", "unknown");
                String trainingDate = (String) result.getOrDefault("training_date", "");
                String description = "Model type: " + modelType + ", trained on: " + trainingDate;

                @SuppressWarnings("unchecked")
                List<String> excludedFeatures = (List<String>) result.getOrDefault("excluded_features", List.of());

                return new ModelInfo(
                        "house-price-regression",
                        "1.0.0",
                        description,
                        List.of("square_footage", "bedrooms", "bathrooms", "year_built",
                                "lot_size", "distance_to_city_center", "school_rating"),
                        "price"
                );
            } else {
                recordFailure();
                log.error("ML service returned status {} for model info: {}", response.statusCode(), response.body());
                throw new DomainException("ML service returned HTTP " + response.statusCode() + " for model info");
            }
        } catch (DomainException e) {
            throw e;
        } catch (Exception e) {
            recordFailure();
            log.error("Failed to get model info: {}", e.getMessage());
            throw new DomainException("Failed to get model info: " + e.getMessage(), e);
        }
    }

    private Map<String, Object> toPayload(PropertyFeatures features) {
        return Map.of(
                "square_footage", features.squareFootage(),
                "bedrooms", features.bedrooms(),
                "bathrooms", features.bathrooms(),
                "year_built", features.yearBuilt(),
                "lot_size", features.lotSize(),
                "distance_to_city_center", features.distanceToCityCenter(),
                "school_rating", features.schoolRating()
        );
    }

    /**
     * Check circuit breaker state.
     *
     * @return true if the circuit is CLOSED or HALF_OPEN (call is allowed),
     *         false if the circuit is OPEN (call should throw exception)
     */
    private boolean checkCircuit() {
        CircuitState currentState = circuitState.get();

        if (currentState == CircuitState.OPEN) {
            Instant openTime = circuitOpenTime.get();
            if (openTime != null &&
                    Instant.now().isAfter(openTime.plus(CIRCUIT_OPEN_DURATION))) {
                // Transition to HALF_OPEN
                if (circuitState.compareAndSet(CircuitState.OPEN, CircuitState.HALF_OPEN)) {
                    log.info("Circuit breaker: transitioning to HALF_OPEN");
                    return true; // Allow one probe call
                }
                // Another thread already transitioned, check again
                return checkCircuit();
            } else {
                log.debug("Circuit breaker: OPEN, rejecting request");
                return false;
            }
        }

        return true; // CLOSED or HALF_OPEN
    }

    private void recordFailure() {
        int failures = failureCount.incrementAndGet();
        if (failures >= FAILURE_THRESHOLD) {
            if (circuitState.compareAndSet(CircuitState.CLOSED, CircuitState.OPEN)) {
                circuitOpenTime.set(Instant.now());
                log.warn("Circuit breaker: OPEN after {} failures", failures);
            }
        }
    }

    private void resetCircuit() {
        failureCount.set(0);
        circuitState.set(CircuitState.CLOSED);
        circuitOpenTime.set(null);
    }

    /** Visible for testing. */
    CircuitState getCircuitState() {
        return circuitState.get();
    }
}

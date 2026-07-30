package com.portal.analytics.adapters.mlclient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portal.analytics.domain.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

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
 * (Connect: 2s, Read: 5s). Implements a thread-safe circuit breaker with
 * fallback to gracefully degrade when the ML service is unavailable.
 */
@Component
public class MlModelClient implements ModelInferencePort {

    private static final Logger log = LoggerFactory.getLogger(MlModelClient.class);

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(5);

    private static final int FAILURE_THRESHOLD = 3;
    private static final Duration CIRCUIT_OPEN_DURATION = Duration.ofSeconds(30);

    private final String mlServiceUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    // Thread-safe circuit breaker state
    private final AtomicInteger failureCount = new AtomicInteger(0);
    private final AtomicReference<CircuitState> circuitState = new AtomicReference<>(CircuitState.CLOSED);
    private final AtomicReference<Instant> circuitOpenTime = new AtomicReference<>(null);

    private enum CircuitState {
        CLOSED, OPEN, HALF_OPEN
    }

    public MlModelClient(
            @Value("${ml.service.url:http://localhost:8000}") String mlServiceUrl,
            ObjectMapper objectMapper
    ) {
        this.mlServiceUrl = mlServiceUrl;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
    }

    @Override
    public PredictionResult predict(PropertyFeatures features) {
        // Check circuit breaker first
        if (!checkCircuit()) {
            log.debug("Circuit breaker is OPEN, using fallback prediction");
            return fallbackPrediction(features);
        }

        String url = mlServiceUrl + "/predict";
        try {
            Map<String, Object> payload = toPayload(features);
            String jsonBody = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(READ_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                resetCircuit();
                Map<String, Object> result = objectMapper.readValue(response.body(), Map.class);

                @SuppressWarnings("unchecked")
                Map<String, Object> data = (Map<String, Object>) result.get("data");

                double predictedPrice = ((Number) data.get("predicted_price")).doubleValue();
                return new PredictionResult(predictedPrice, features, Instant.now());
            } else {
                recordFailure();
                log.warn("ML service returned status {}: {}", response.statusCode(), response.body());
                return fallbackPrediction(features);
            }
        } catch (Exception e) {
            recordFailure();
            log.warn("ML service call failed, using fallback: {}", e.getMessage());
            return fallbackPrediction(features);
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
        // Apply circuit breaker pattern
        if (!checkCircuit()) {
            log.debug("Circuit breaker is OPEN, using fallback model info");
            return getFallbackModelInfo();
        }

        String url = mlServiceUrl + "/model-info";
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(READ_TIMEOUT)
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                resetCircuit();
                Map<String, Object> result = objectMapper.readValue(response.body(), Map.class);

                @SuppressWarnings("unchecked")
                Map<String, Object> data = (Map<String, Object>) result.get("data");

                return new ModelInfo(
                        (String) data.getOrDefault("model_name", "unknown"),
                        (String) data.getOrDefault("model_version", "unknown"),
                        (String) data.getOrDefault("description", ""),
                        (List<String>) data.getOrDefault("features", List.of()),
                        (String) data.getOrDefault("target", "price")
                );
            } else {
                recordFailure();
                log.warn("ML service returned status {} for model info", response.statusCode());
                return getFallbackModelInfo();
            }
        } catch (Exception e) {
            recordFailure();
            log.warn("Failed to get model info, using fallback: {}", e.getMessage());
            return getFallbackModelInfo();
        }
    }

    private ModelInfo getFallbackModelInfo() {
        return new ModelInfo(
                "house-price-prediction",
                "1.0.0",
                "House price prediction model (fallback)",
                List.of("square_footage", "bedrooms", "bathrooms", "year_built",
                        "lot_size", "distance_to_city_center", "school_rating"),
                "price"
        );
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
     * Simple fallback prediction using a linear formula when ML service is unavailable.
     */
    private PredictionResult fallbackPrediction(PropertyFeatures features) {
        double fallbackPrice = features.squareFootage() * 150
                + features.bedrooms() * 15000
                - features.distanceToCityCenter() * 8000
                + features.schoolRating() * 12000
                + features.lotSize() * 15
                + (features.yearBuilt() - 1950) * 800;

        return new PredictionResult(fallbackPrice, features, Instant.now());
    }

    /**
     * Check circuit breaker state.
     *
     * @return true if the circuit is CLOSED or HALF_OPEN (call is allowed),
     *         false if the circuit is OPEN (call should use fallback)
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
                log.debug("Circuit breaker: OPEN, using fallback");
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
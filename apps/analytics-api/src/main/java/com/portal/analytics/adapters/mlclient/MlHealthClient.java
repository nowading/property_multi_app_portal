package com.portal.analytics.adapters.mlclient;

import com.portal.analytics.domain.HealthPort;
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

/**
 * Health check adapter for the ML model container.
 *
 * <p>Phase C: when {@code ml.service.trust-store-path} is set, the HTTP
 * client is built with a custom {@link SSLContext} so the self-signed
 * ML certificate is trusted.
 */
@Component
public class MlHealthClient implements HealthPort {

    private static final Logger log = LoggerFactory.getLogger(MlHealthClient.class);

    private final String mlServiceUrl;
    private final String internalServiceToken;
    private final HttpClient httpClient;

    @Autowired
    public MlHealthClient(
            @Value("${ml.service.url:http://localhost:8000}") String mlServiceUrl,
            @Value("${ml.service.token:}") String internalServiceToken,
            @Value("${ml.service.trust-store-path:}") String trustStorePath,
            @Value("${ml.service.trust-store-password:}") String trustStorePassword
    ) {
        this.mlServiceUrl = mlServiceUrl;
        this.internalServiceToken = internalServiceToken == null ? "" : internalServiceToken;
        HttpClient.Builder builder = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .version(HttpClient.Version.HTTP_1_1);
        SSLContext sslContext = MlTlsContextFactory.build(trustStorePath, trustStorePassword);
        if (sslContext != null) {
            builder.sslContext(sslContext);
            log.info("MlHealthClient: SSL context configured from trust store {}", trustStorePath);
        }
        this.httpClient = builder.build();
        if (this.internalServiceToken.isEmpty()) {
            log.warn("ml.service.token is not configured; ML health probe will NOT include x-internal-token header.");
        } else {
            log.info("MlHealthClient: x-internal-token header will be attached to health probes (length={})",
                    this.internalServiceToken.length());
        }
    }

    /**
     * Convenience constructor used by unit tests that do not exercise TLS.
     * Falls back to the JVM default trust store.
     */
    public MlHealthClient(String mlServiceUrl, String internalServiceToken) {
        this(mlServiceUrl, internalServiceToken, "", "");
    }

    @Override
    public boolean isHealthy() {
        String url = mlServiceUrl + "/health";
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(3));
            if (!internalServiceToken.isEmpty()) {
                builder.header("x-internal-token", internalServiceToken);
            }
            HttpRequest request = builder.GET().build();

            HttpResponse<Void> response = httpClient.send(
                    request, HttpResponse.BodyHandlers.discarding()
            );

            return response.statusCode() == 200;
        } catch (Exception e) {
            log.debug("ML health check failed: {}", e.getMessage());
            return false;
        }
    }
}
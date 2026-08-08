package com.portal.analytics.adapters.mlclient;

import com.portal.analytics.domain.HealthPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Health check adapter for the ML model container.
 */
@Component
public class MlHealthClient implements HealthPort {

    private static final Logger log = LoggerFactory.getLogger(MlHealthClient.class);

    private final String mlServiceUrl;
    private final String internalServiceToken;
    private final HttpClient httpClient;

    public MlHealthClient(
            @Value("${ml.service.url:http://localhost:8000}") String mlServiceUrl,
            @Value("${ml.service.token:}") String internalServiceToken
    ) {
        this.mlServiceUrl = mlServiceUrl;
        this.internalServiceToken = internalServiceToken == null ? "" : internalServiceToken;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .version(HttpClient.Version.HTTP_1_1)
                .build();
        if (this.internalServiceToken.isEmpty()) {
            log.warn("ml.service.token is not configured; ML health probe will NOT include x-internal-token header.");
        } else {
            log.info("MlHealthClient: x-internal-token header will be attached to health probes (length={})",
                    this.internalServiceToken.length());
        }
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
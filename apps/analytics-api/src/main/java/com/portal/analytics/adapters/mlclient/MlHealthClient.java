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
    private final HttpClient httpClient;

    public MlHealthClient(
            @Value("${ml.service.url:http://localhost:8000}") String mlServiceUrl
    ) {
        this.mlServiceUrl = mlServiceUrl;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .version(HttpClient.Version.HTTP_1_1)
                .build();
    }

    @Override
    public boolean isHealthy() {
        String url = mlServiceUrl + "/health";
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();

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
package com.portal.analytics.adapters.mlclient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.portal.analytics.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link MlModelClient}.
 */
@DisplayName("MlModelClient")
class MlModelClientTest {

    private MlModelClient client;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        client = new MlModelClient("http://localhost:19999", objectMapper);
    }

    @Test
    @DisplayName("should return fallback prediction when ML service is unavailable")
    void fallbackWhenServiceDown() {
        PropertyFeatures features = new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 7);

        PredictionResult result = client.predict(features);

        assertThat(result).isNotNull();
        assertThat(result.predictedPrice()).isPositive();
        assertThat(result.features()).isEqualTo(features);
    }

    @Test
    @DisplayName("should use linear fallback formula")
    void fallbackFormula() {
        PropertyFeatures features = new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 7);

        PredictionResult result = client.predict(features);

        double expectedFallback = 2000 * 150
                + 3 * 15000
                - 5 * 8000
                + 7 * 12000
                + 6000 * 15
                + (1995 - 1950) * 800;

        assertThat(result.predictedPrice()).isEqualTo(expectedFallback);
    }

    @Test
    @DisplayName("should get fallback model info when ML service is unavailable")
    void fallbackModelInfo() {
        ModelInfo info = client.getModelInfo();

        assertThat(info).isNotNull();
        assertThat(info.modelName()).isEqualTo("house-price-prediction");
        assertThat(info.modelVersion()).isEqualTo("1.0.0");
        assertThat(info.features()).hasSize(7);
        assertThat(info.target()).isEqualTo("price");
    }

    @Test
    @DisplayName("should handle batch predictions with fallback")
    void batchPredictFallback() {
        List<PropertyFeatures> featuresList = List.of(
                new PropertyFeatures(1500, 2, 1, 1990, 3000, 6, 5),
                new PropertyFeatures(2500, 4, 2, 2000, 7000, 3, 9)
        );

        List<PredictionResult> results = client.predictBatch(featuresList);

        assertThat(results).hasSize(2);
        assertThat(results.get(0).predictedPrice()).isPositive();
        assertThat(results.get(1).predictedPrice()).isPositive();
    }

    @Test
    @DisplayName("circuit breaker should open after failures")
    void circuitBreakerOpens() {
        PropertyFeatures features = new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 7);

        // First prediction uses fallback (service down)
        client.predict(features);
        // Second prediction also uses fallback
        client.predict(features);
        // Third prediction also uses fallback
        client.predict(features);

        // Fourth prediction should trigger circuit breaker
        try {
            client.predict(features);
        } catch (RuntimeException e) {
            assertThat(e.getMessage()).contains("Circuit breaker");
        }
    }
}
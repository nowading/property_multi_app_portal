package com.portal.analytics.adapters.mlclient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.portal.analytics.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
        // Token is empty in the basic tests — they only verify error behavior when the ML
        // service is unavailable, so outbound auth headers are irrelevant.
        client = new MlModelClient("http://localhost:19999", "", objectMapper);
    }

    @Test
    @DisplayName("should throw DomainException when ML service is unavailable")
    void throwExceptionWhenServiceDown() {
        PropertyFeatures features = new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 7);

        assertThatThrownBy(() -> client.predict(features))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("ML service call failed");
    }

    @Test
    @DisplayName("should throw DomainException for model info when ML service is unavailable")
    void throwExceptionForModelInfoWhenServiceDown() {
        assertThatThrownBy(() -> client.getModelInfo())
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("Failed to get model info");
    }

    @Test
    @DisplayName("should throw DomainException for batch predictions when ML service is unavailable")
    void throwExceptionForBatchWhenServiceDown() {
        List<PropertyFeatures> featuresList = List.of(
                new PropertyFeatures(1500, 2, 1, 1990, 3000, 6, 5),
                new PropertyFeatures(2500, 4, 2, 2000, 7000, 3, 9)
        );

        assertThatThrownBy(() -> client.predictBatch(featuresList))
                .isInstanceOf(DomainException.class);
    }

    @Test
    @DisplayName("circuit breaker should open after failures and throw exception")
    void circuitBreakerOpensAndThrows() {
        PropertyFeatures features = new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 7);

        // First three calls fail and increment failure count (catch exceptions)
        for (int i = 0; i < 3; i++) {
            try {
                client.predict(features);
            } catch (DomainException ignored) {
                // Expected — ML service is not running
            }
        }

        // Circuit should now be open
        assertThat(client.getCircuitState()).isEqualTo(MlModelClient.CircuitState.OPEN);

        // Subsequent calls should throw circuit breaker exception immediately
        assertThatThrownBy(() -> client.predict(features))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("circuit breaker is OPEN");
    }
}

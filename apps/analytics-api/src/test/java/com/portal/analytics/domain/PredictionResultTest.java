package com.portal.analytics.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link PredictionResult}.
 */
@DisplayName("PredictionResult")
class PredictionResultTest {

    @Test
    @DisplayName("should create prediction result with timestamp")
    void createWithTimestamp() {
        PropertyFeatures features = new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 7);
        Instant before = Instant.now();
        PredictionResult result = PredictionResult.now(250000.0, features);
        Instant after = Instant.now();

        assertThat(result.predictedPrice()).isEqualTo(250000.0);
        assertThat(result.features()).isEqualTo(features);
        assertThat(result.timestamp()).isBetween(before, after);
    }
}
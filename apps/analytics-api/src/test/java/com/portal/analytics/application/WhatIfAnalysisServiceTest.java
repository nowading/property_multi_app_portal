package com.portal.analytics.application;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.portal.analytics.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link WhatIfAnalysisService}.
 */
@DisplayName("WhatIfAnalysisService")
class WhatIfAnalysisServiceTest {

    private WhatIfAnalysisService service;
    private MockModelInferencePort mockPort;

    @BeforeEach
    void setUp() {
        mockPort = new MockModelInferencePort();
        Cache<String, WhatIfResult> cache = Caffeine.newBuilder()
                .maximumSize(100)
                .build();
        service = new WhatIfAnalysisService(mockPort, cache);
    }

    @Test
    @DisplayName("should compute delta correctly")
    void computeDelta() {
        PropertyFeatures modified = new PropertyFeatures(3000, 4, 2, 2000, 8000, 3, 8);
        PropertyFeatures baseline = WhatIfAnalysisService.DEFAULT_BASELINE;

        WhatIfResult result = service.analyze(modified, baseline);

        assertThat(result.predictedPrice()).isNotZero();
        assertThat(result.baselinePrice()).isNotZero();
        assertThat(result.delta()).isEqualTo(result.predictedPrice() - result.baselinePrice());
    }

    @Test
    @DisplayName("should use default baseline when null is provided")
    void defaultBaseline() {
        PropertyFeatures modified = new PropertyFeatures(2500, 3, 2, 2000, 7000, 4, 7);

        WhatIfResult result = service.analyzeWithDefaultBaseline(modified);

        assertThat(result.features()).isEqualTo(modified);
        assertThat(result.baselinePrice()).isNotZero();
    }

    @Test
    @DisplayName("should compute zero delta when features match baseline")
    void zeroDelta() {
        PropertyFeatures baseline = WhatIfAnalysisService.DEFAULT_BASELINE;

        WhatIfResult result = service.analyze(baseline, baseline);

        assertThat(result.delta()).isEqualTo(0.0);
        assertThat(result.deltaPercent()).isEqualTo(0.0);
    }

    /**
     * Mock model inference port that returns deterministic predictions.
     */
    private static class MockModelInferencePort implements ModelInferencePort {

        @Override
        public PredictionResult predict(PropertyFeatures features) {
            double price = features.squareFootage() * 150
                    + features.bedrooms() * 15000
                    - features.distanceToCityCenter() * 8000
                    + features.schoolRating() * 12000
                    + features.lotSize() * 10;
            return new PredictionResult(price, features, Instant.now());
        }

        @Override
        public List<PredictionResult> predictBatch(List<PropertyFeatures> featuresList) {
            return featuresList.stream().map(this::predict).toList();
        }

        @Override
        public ModelInfo getModelInfo() {
            return new ModelInfo("house-price-model", "1.0", "Test model",
                    List.of("sqft", "beds", "baths"), "price");
        }
    }
}
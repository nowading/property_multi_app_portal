package com.portal.analytics.application;

import com.portal.analytics.domain.*;
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

    @Test
    @DisplayName("toCacheKey should generate consistent keys for same features")
    void cacheKeyGeneration() {
        PropertyFeatures modified = new PropertyFeatures(3000, 4, 2, 2000, 8000, 3, 8);
        PropertyFeatures baseline = PropertyFeatures.DEFAULT_BASELINE;

        String key1 = WhatIfAnalysisService.toCacheKey(modified, baseline);
        String key2 = WhatIfAnalysisService.toCacheKey(modified, baseline);

        assertThat(key1).isEqualTo(key2);
        assertThat(key1).startsWith("wi:");
        assertThat(key1).contains("3000.0");
        assertThat(key1).contains("2000.0");
    }

    @Test
    @DisplayName("toCacheKey should use DEFAULT_BASELINE when baseline is null")
    void cacheKeyDefaultBaseline() {
        PropertyFeatures modified = new PropertyFeatures(2500, 3, 2, 2000, 7000, 4, 7);

        String key = WhatIfAnalysisService.toCacheKey(modified, null);

        assertThat(key).startsWith("wi:");
        // Should contain DEFAULT_BASELINE values (2000, 3, 2, 1995, 6000, 5, 7)
        assertThat(key).contains("2000.0");
        assertThat(key).contains(",3,");
    }

    @Test
    @DisplayName("cache key should differ for different feature combinations")
    void cacheKeyDiffers() {
        PropertyFeatures features1 = new PropertyFeatures(3000, 4, 2, 2000, 8000, 3, 8);
        PropertyFeatures features2 = new PropertyFeatures(2500, 3, 2, 2000, 7000, 4, 7);

        String key1 = WhatIfAnalysisService.toCacheKey(features1, PropertyFeatures.DEFAULT_BASELINE);
        String key2 = WhatIfAnalysisService.toCacheKey(features2, PropertyFeatures.DEFAULT_BASELINE);

        assertThat(key1).isNotEqualTo(key2);
    }

    /**
     * Standalone test for computeDelta logic (without Spring context).
     */
    @Test
    @DisplayName("computeDelta logic should be correct")
    void computeDeltaLogic() {
        MockModelInferencePort mockPort = new MockModelInferencePort();
        BaselinePriceCacheService cacheService = new BaselinePriceCacheService(mockPort);
        BaselinePredictionService baselineService = new BaselinePredictionService(cacheService);
        WhatIfAnalysisService service = new WhatIfAnalysisService(mockPort, baselineService);

        PropertyFeatures modified = new PropertyFeatures(3000, 4, 2, 2000, 8000, 3, 8);
        PropertyFeatures baseline = PropertyFeatures.DEFAULT_BASELINE;

        WhatIfResult result = service.analyze(modified, baseline);

        assertThat(result.predictedPrice()).isNotZero();
        assertThat(result.baselinePrice()).isNotZero();
        assertThat(result.delta()).isEqualTo(result.predictedPrice() - result.baselinePrice());
    }

    @Test
    @DisplayName("zero delta when features match baseline")
    void zeroDelta() {
        MockModelInferencePort mockPort = new MockModelInferencePort();
        BaselinePriceCacheService cacheService = new BaselinePriceCacheService(mockPort);
        BaselinePredictionService baselineService = new BaselinePredictionService(cacheService);
        WhatIfAnalysisService service = new WhatIfAnalysisService(mockPort, baselineService);

        PropertyFeatures baseline = PropertyFeatures.DEFAULT_BASELINE;

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
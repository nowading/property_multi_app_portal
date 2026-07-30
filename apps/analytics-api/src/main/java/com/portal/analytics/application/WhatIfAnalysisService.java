package com.portal.analytics.application;

import com.github.benmanes.caffeine.cache.Cache;
import com.portal.analytics.adapters.persistence.CacheConfig;
import com.portal.analytics.domain.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

/**
 * Service for what-if analysis — comparing predicted price changes
 * when property features are modified from baseline values.
 *
 * <p>This service orchestrates the {@link ModelInferencePort} to get
 * predictions and computes the delta from baseline.
 *
 * <p>Results are cached in Caffeine for 60 seconds with max 500 entries per cache key.
 */
@Service
public class WhatIfAnalysisService {

    private final ModelInferencePort modelInferencePort;
    private final Cache<String, WhatIfResult> whatIfCache;

    public WhatIfAnalysisService(ModelInferencePort modelInferencePort,
                                 @Qualifier(CacheConfig.WHAT_IF_CACHE) Cache<String, WhatIfResult> whatIfCache) {
        this.modelInferencePort = modelInferencePort;
        this.whatIfCache = whatIfCache;
    }

    /**
     * Run a what-if analysis comparing modified features against baseline.
     * Results are cached using feature values as cache key.
     *
     * @param modifiedFeatures the modified features to predict
     * @param baselineFeatures the baseline features (null = use defaults)
     * @return what-if result with predicted price, baseline, and delta
     */
    public WhatIfResult analyze(PropertyFeatures modifiedFeatures, PropertyFeatures baselineFeatures) {
        PropertyFeatures baseline = baselineFeatures != null ? baselineFeatures : PropertyFeatures.DEFAULT_BASELINE;

        String cacheKey = toCacheKey(modifiedFeatures, baseline);

        return whatIfCache.get(cacheKey, key -> computeAnalysis(modifiedFeatures, baseline));
    }

    private WhatIfResult computeAnalysis(PropertyFeatures modifiedFeatures, PropertyFeatures baseline) {
        PredictionResult predicted = modelInferencePort.predict(modifiedFeatures);
        PredictionResult baselineResult = modelInferencePort.predict(baseline);

        double delta = predicted.predictedPrice() - baselineResult.predictedPrice();
        double deltaPercent = baselineResult.predictedPrice() != 0
                ? (delta / baselineResult.predictedPrice()) * 100
                : 0.0;

        return new WhatIfResult(
                Math.round(predicted.predictedPrice() * 100.0) / 100.0,
                Math.round(baselineResult.predictedPrice() * 100.0) / 100.0,
                Math.round(delta * 100.0) / 100.0,
                Math.round(deltaPercent * 100.0) / 100.0,
                modifiedFeatures
        );
    }

    private String toCacheKey(PropertyFeatures modified, PropertyFeatures baseline) {
        return String.format("wi:%.1f,%d,%.1f,%d,%.1f,%.1f,%.1f|%.1f,%d,%.1f,%d,%.1f,%.1f,%.1f",
                modified.squareFootage(), modified.bedrooms(), modified.bathrooms(),
                modified.yearBuilt(), modified.lotSize(), modified.distanceToCityCenter(), modified.schoolRating(),
                baseline.squareFootage(), baseline.bedrooms(), baseline.bathrooms(),
                baseline.yearBuilt(), baseline.lotSize(), baseline.distanceToCityCenter(), baseline.schoolRating());
    }

    /**
     * Run what-if analysis with default baseline.
     *
     * @param modifiedFeatures the modified features to predict
     * @return what-if result
     */
    public WhatIfResult analyzeWithDefaultBaseline(PropertyFeatures modifiedFeatures) {
        return analyze(modifiedFeatures, PropertyFeatures.DEFAULT_BASELINE);
    }
}
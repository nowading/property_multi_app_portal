package com.portal.analytics.application;

import com.portal.analytics.adapters.persistence.CacheConfig;
import com.portal.analytics.domain.*;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Service for what-if analysis — comparing predicted price changes
 * when property features are modified from baseline values.
 *
 * <p>This service orchestrates the {@link ModelInferencePort} to get
 * predictions and computes the delta from baseline.
 *
 * <p>Results are cached in Redis for 60 seconds with key derived from feature values.
 */
@Service
public class WhatIfAnalysisService {

    private final ModelInferencePort modelInferencePort;

    public WhatIfAnalysisService(ModelInferencePort modelInferencePort) {
        this.modelInferencePort = modelInferencePort;
    }

    /**
     * Run a what-if analysis comparing modified features against baseline.
     * Results are cached using feature values as cache key.
     *
     * @param modifiedFeatures the modified features to predict
     * @param baselineFeatures the baseline features (null = use defaults)
     * @return what-if result with predicted price, baseline, and delta
     */
    @Cacheable(value = CacheConfig.WHAT_IF_CACHE, key = "T(com.portal.analytics.application.WhatIfAnalysisService).toCacheKey(#modifiedFeatures, #baselineFeatures)")
    public WhatIfResult analyze(PropertyFeatures modifiedFeatures, PropertyFeatures baselineFeatures) {
        PropertyFeatures baseline = baselineFeatures != null ? baselineFeatures : PropertyFeatures.DEFAULT_BASELINE;

        return computeAnalysis(modifiedFeatures, baseline);
    }

    /**
     * Run what-if analysis with default baseline features.
     *
     * @param modifiedFeatures the modified features to predict
     * @return what-if result with predicted price, baseline, and delta
     */
    @Cacheable(value = CacheConfig.WHAT_IF_CACHE, key = "T(com.portal.analytics.application.WhatIfAnalysisService).toCacheKey(#modifiedFeatures, null)")
    public WhatIfResult analyzeWithDefaultBaseline(PropertyFeatures modifiedFeatures) {
        return analyze(modifiedFeatures, PropertyFeatures.DEFAULT_BASELINE);
    }

    private WhatIfResult computeAnalysis(PropertyFeatures modified, PropertyFeatures baseline) {
        PredictionResult modifiedResult = modelInferencePort.predict(modified);
        PredictionResult baselineResult = modelInferencePort.predict(baseline);

        double delta = modifiedResult.predictedPrice() - baselineResult.predictedPrice();
        double deltaPercent = baselineResult.predictedPrice() != 0
                ? (delta / baselineResult.predictedPrice()) * 100
                : 0.0;

        return new WhatIfResult(
                modifiedResult.predictedPrice(),
                baselineResult.predictedPrice(),
                delta,
                deltaPercent,
                modified
        );
    }

    /**
     * Generate cache key from feature values for Redis cache.
     * Must be public for Spring expression language access.
     */
    public static String toCacheKey(PropertyFeatures modified, PropertyFeatures baseline) {
        PropertyFeatures effectiveBaseline = baseline != null ? baseline : PropertyFeatures.DEFAULT_BASELINE;
        return String.format("wi:%.1f,%d,%.1f,%d,%.1f,%.1f,%.1f|%.1f,%d,%.1f,%d,%.1f,%.1f,%.1f",
                modified.squareFootage(), modified.bedrooms(), modified.bathrooms(),
                modified.yearBuilt(), modified.lotSize(), modified.distanceToCityCenter(), modified.schoolRating(),
                effectiveBaseline.squareFootage(), effectiveBaseline.bedrooms(), effectiveBaseline.bathrooms(),
                effectiveBaseline.yearBuilt(), effectiveBaseline.lotSize(), effectiveBaseline.distanceToCityCenter(), effectiveBaseline.schoolRating());
    }
}
package com.portal.analytics.application;

import com.portal.analytics.domain.*;
import org.springframework.stereotype.Service;

/**
 * Service for what-if analysis — comparing predicted price changes
 * when property features are modified from baseline values.
 *
 * <p>This service orchestrates the {@link ModelInferencePort} to get
 * predictions and computes the delta from baseline.
 */
@Service
public class WhatIfAnalysisService {

    /** Default baseline features (median market values). */
    public static final PropertyFeatures DEFAULT_BASELINE = new PropertyFeatures(
            2000, 3, 2, 1995, 6000, 5, 7
    );

    private final ModelInferencePort modelInferencePort;

    public WhatIfAnalysisService(ModelInferencePort modelInferencePort) {
        this.modelInferencePort = modelInferencePort;
    }

    /**
     * Run a what-if analysis comparing modified features against baseline.
     *
     * @param modifiedFeatures the modified features to predict
     * @param baselineFeatures the baseline features (null = use defaults)
     * @return what-if result with predicted price, baseline, and delta
     */
    public WhatIfResult analyze(PropertyFeatures modifiedFeatures, PropertyFeatures baselineFeatures) {
        PropertyFeatures baseline = baselineFeatures != null ? baselineFeatures : DEFAULT_BASELINE;

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

    /**
     * Run what-if analysis with default baseline.
     *
     * @param modifiedFeatures the modified features to predict
     * @return what-if result
     */
    public WhatIfResult analyzeWithDefaultBaseline(PropertyFeatures modifiedFeatures) {
        return analyze(modifiedFeatures, DEFAULT_BASELINE);
    }
}
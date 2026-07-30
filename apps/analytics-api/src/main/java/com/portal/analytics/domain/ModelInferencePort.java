package com.portal.analytics.domain;

import java.util.List;

/**
 * Port for calling the ML model container.
 *
 * <p>Adapters implement this interface to provide the actual HTTP
 * communication with the ML service. The application layer depends
 * on this abstraction, not on concrete HTTP clients.
 */
public interface ModelInferencePort {

    /**
     * Run a single prediction.
     *
     * @param features property features
     * @return prediction result
     */
    PredictionResult predict(PropertyFeatures features);

    /**
     * Run a batch prediction preserving input order.
     *
     * @param featuresList list of property features
     * @return list of prediction results in the same order
     */
    List<PredictionResult> predictBatch(List<PropertyFeatures> featuresList);

    /**
     * Get ML model metadata.
     *
     * @return model information
     */
    ModelInfo getModelInfo();
}
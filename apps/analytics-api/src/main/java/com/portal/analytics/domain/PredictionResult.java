package com.portal.analytics.domain;

import java.time.Instant;

/**
 * Immutable prediction result from a single model inference.
 *
 * @param predictedPrice predicted property price
 * @param features       input features used for prediction
 * @param timestamp      when the prediction was made
 */
public record PredictionResult(
        double predictedPrice,
        PropertyFeatures features,
        Instant timestamp
) {
    public static PredictionResult now(double price, PropertyFeatures features) {
        return new PredictionResult(price, features, Instant.now());
    }
}
package com.portal.analytics.domain;

/**
 * ML model metadata.
 *
 * @param modelName    model identifier
 * @param modelVersion model version string
 * @param description  human-readable description
 * @param features     list of feature names used by the model
 * @param target       target variable predicted by the model
 */
public record ModelInfo(
        String modelName,
        String modelVersion,
        String description,
        java.util.List<String> features,
        String target
) {
}
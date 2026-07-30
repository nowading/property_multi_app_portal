package com.portal.analytics.domain;

/**
 * Result of a what-if analysis comparing predicted price to baseline.
 *
 * @param predictedPrice  predicted price with modified features
 * @param baselinePrice   baseline price with default/median features
 * @param delta           absolute price change (predicted - baseline)
 * @param deltaPercent    percentage change from baseline
 * @param features        features used for the prediction
 */
public record WhatIfResult(
        double predictedPrice,
        double baselinePrice,
        double delta,
        double deltaPercent,
        PropertyFeatures features
) {
}
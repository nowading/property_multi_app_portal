/**
 * Mock prediction function for the what-if analysis tool.
 *
 * Mirrors the price formula used in the dataset generator so that
 * what-if predictions are consistent with the displayed dataset.
 * Will be replaced by real ML API call in Phase 5.
 */

import {
  DEFAULT_WHAT_IF_FEATURES,
  type WhatIfFeatures,
  type WhatIfResult,
} from "@/lib/schemas/analytics";

/**
 * Simplified housing price prediction model.
 *
 * Formula (matches the dataset generator):
 *   price = sqft * 150
 *         + bedrooms * 15000
 *         - distance * 8000
 *         + schoolRating * 12000
 *         + (yearBuilt - 1950) * 800
 *         + lotSize * 15
 *         + bathrooms * 20000
 *
 * Clamps to the realistic range [50_000, 2_000_000].
 */
export function predictPrice(features: WhatIfFeatures): number {
  const basePrice =
    features.square_footage * 150 +
    features.bedrooms * 15000 +
    features.bathrooms * 20000 -
    features.distance_to_city_center * 8000 +
    features.school_rating * 12000 +
    (features.year_built - 1950) * 800 +
    features.lot_size * 15;

  return Math.max(50_000, Math.min(2_000_000, Math.round(basePrice)));
}

/**
 * Run a what-if analysis: predicts price for given features and
 * compares against the baseline (default) feature set.
 */
export function runWhatIfAnalysis(
  features: WhatIfFeatures,
  baseline: WhatIfFeatures = DEFAULT_WHAT_IF_FEATURES
): WhatIfResult {
  const predicted = predictPrice(features);
  const baselinePrice = predictPrice(baseline);
  const delta = predicted - baselinePrice;
  const deltaPercent = baselinePrice !== 0 ? (delta / baselinePrice) * 100 : 0;

  return {
    predicted_price: predicted,
    baseline_price: baselinePrice,
    delta,
    delta_percent: Math.round(deltaPercent * 10) / 10,
    features,
  };
}
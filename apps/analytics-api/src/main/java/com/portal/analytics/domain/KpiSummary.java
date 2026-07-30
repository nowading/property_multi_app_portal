package com.portal.analytics.domain;

/**
 * Key Performance Indicator summary for the housing market.
 *
 * @param count               total number of listings
 * @param avgPrice            average property price
 * @param medianPrice         median property price
 * @param minPrice            minimum property price
 * @param maxPrice            maximum property price
 * @param stdDevPrice         standard deviation of prices
 * @param avgSquareFootage    average square footage
 * @param avgPricePerSqFt     average price per square foot
 */
public record KpiSummary(
        long count,
        double avgPrice,
        double medianPrice,
        double minPrice,
        double maxPrice,
        double stdDevPrice,
        double avgSquareFootage,
        double avgPricePerSqFt
) {
}
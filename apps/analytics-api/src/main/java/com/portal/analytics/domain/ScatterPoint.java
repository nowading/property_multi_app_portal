package com.portal.analytics.domain;

/**
 * A single point in the price vs. square footage scatter plot.
 *
 * @param squareFootage property square footage
 * @param price         property price
 * @param bedrooms      number of bedrooms (for color coding)
 */
public record ScatterPoint(
        double squareFootage,
        double price,
        int bedrooms
) {
}
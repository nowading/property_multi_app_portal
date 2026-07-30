package com.portal.analytics.domain;

/**
 * Immutable value object representing the 7 ML input features.
 *
 * <p>Domain-level constraints are enforced here. The web adapter's DTOs
 * may duplicate rules for HTTP-facing validation; keeping them here lets
 * the application layer construct entities safely without going through HTTP.
 *
 * @param squareFootage total living area in square feet (must be > 0)
 * @param bedrooms      number of bedrooms (must be >= 0)
 * @param bathrooms     number of bathrooms (must be >= 0)
 * @param yearBuilt     year the property was built (1800 to current year)
 * @param lotSize       lot size in square feet (must be > 0)
 * @param distanceToCityCenter distance to city center in miles (must be >= 0)
 * @param schoolRating  local school rating 1-10
 */
public record PropertyFeatures(
        double squareFootage,
        int bedrooms,
        double bathrooms,
        int yearBuilt,
        double lotSize,
        double distanceToCityCenter,
        double schoolRating
) {
    /**
     * Default baseline features representing median market values.
     *
     * <p>Single source of truth shared by {@code WhatIfAnalysisService},
     * {@code CsvDatasetPort}, and any other consumer needing default
     * property features.
     */
    public static final PropertyFeatures DEFAULT_BASELINE = new PropertyFeatures(
            2000, 3, 2, 1995, 6000, 5, 7
    );

    public PropertyFeatures {
        int currentYear = java.time.Year.now().getValue();

        if (squareFootage <= 0) {
            throw new IllegalArgumentException("square_footage must be > 0");
        }
        if (bedrooms < 0) {
            throw new IllegalArgumentException("bedrooms must be >= 0");
        }
        if (bathrooms < 0) {
            throw new IllegalArgumentException("bathrooms must be >= 0");
        }
        if (yearBuilt < 1800) {
            throw new IllegalArgumentException("year_built must be >= 1800");
        }
        if (yearBuilt > currentYear) {
            throw new IllegalArgumentException("year_built must be <= " + currentYear);
        }
        if (lotSize <= 0) {
            throw new IllegalArgumentException("lot_size must be > 0");
        }
        if (distanceToCityCenter < 0) {
            throw new IllegalArgumentException("distance_to_city_center must be >= 0");
        }
        if (schoolRating < 1.0) {
            throw new IllegalArgumentException("school_rating must be >= 1");
        }
        if (schoolRating > 10.0) {
            throw new IllegalArgumentException("school_rating must be <= 10");
        }
    }
}
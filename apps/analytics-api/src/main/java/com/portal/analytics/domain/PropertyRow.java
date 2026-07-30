package com.portal.analytics.domain;

/**
 * A single property row from the housing dataset.
 *
 * @param id                     unique row identifier
 * @param squareFootage          total living area
 * @param bedrooms               number of bedrooms
 * @param bathrooms              number of bathrooms
 * @param yearBuilt              year the property was built
 * @param lotSize                lot size in square feet
 * @param distanceToCityCenter   distance to city center in miles
 * @param schoolRating           local school rating 1-10
 * @param price                  property price
 */
public record PropertyRow(
        int id,
        double squareFootage,
        int bedrooms,
        double bathrooms,
        int yearBuilt,
        double lotSize,
        double distanceToCityCenter,
        double schoolRating,
        double price
) {
    /** Convert to PropertyFeatures for ML inference (excludes price). */
    public PropertyFeatures toFeatures() {
        return new PropertyFeatures(
                squareFootage, bedrooms, bathrooms, yearBuilt,
                lotSize, distanceToCityCenter, schoolRating
        );
    }
}
package com.portal.analytics.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * Optional filters for market statistics queries.
 *
 * @param bedroomsMin     minimum bedroom count (inclusive), null = no filter
 * @param bedroomsMax     maximum bedroom count (inclusive), null = no filter
 * @param yearBuiltMin    minimum year built (inclusive), null = no filter
 * @param yearBuiltMax    maximum year built (inclusive), null = no filter
 * @param distanceMax     maximum distance to city center, null = no filter
 * @param schoolRatingMin minimum school rating (inclusive), null = no filter
 * @param schoolRatingMax maximum school rating (inclusive), null = no filter
 * @param priceMin        minimum price (inclusive), null = no filter
 * @param priceMax        maximum price (inclusive), null = no filter
 */
public record StatsFilters(
        Integer bedroomsMin,
        Integer bedroomsMax,
        Integer yearBuiltMin,
        Integer yearBuiltMax,
        Double distanceMax,
        Double schoolRatingMin,
        Double schoolRatingMax,
        Double priceMin,
        Double priceMax
) {
    /** Return true if no filters are applied (all null). */
    @JsonIgnore
    public boolean isEmpty() {
        return bedroomsMin == null
                && bedroomsMax == null
                && yearBuiltMin == null
                && yearBuiltMax == null
                && distanceMax == null
                && schoolRatingMin == null
                && schoolRatingMax == null
                && priceMin == null
                && priceMax == null;
    }

    /** Generate a cache key from non-null filter values. */
    public String cacheKey() {
        if (isEmpty()) {
            return "default";
        }
        return String.format(
                "b%d-%d_y%d-%d_d%.0f_s%.1f-%.1f_p%.0f-%.0f",
                bedroomsMin != null ? bedroomsMin : -1,
                bedroomsMax != null ? bedroomsMax : -1,
                yearBuiltMin != null ? yearBuiltMin : -1,
                yearBuiltMax != null ? yearBuiltMax : -1,
                distanceMax != null ? distanceMax : -1,
                schoolRatingMin != null ? schoolRatingMin : -1,
                schoolRatingMax != null ? schoolRatingMax : -1,
                priceMin != null ? priceMin : -1,
                priceMax != null ? priceMax : -1
        );
    }
}
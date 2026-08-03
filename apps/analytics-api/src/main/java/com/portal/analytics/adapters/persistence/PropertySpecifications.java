package com.portal.analytics.adapters.persistence;

import com.portal.analytics.domain.StatsFilters;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/**
 * Utility class for building JPA Specifications from {@link StatsFilters}.
 */
public final class PropertySpecifications {

    private PropertySpecifications() {
    }

    /**
     * Build a Specification from the given filters.
     * Returns null if no filters are applied (meaning match all).
     */
    public static Specification<PropertyEntity> fromFilters(StatsFilters filters) {
        if (filters == null || filters.isEmpty()) {
            return null;
        }

        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (filters.bedroomsMin() != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("bedrooms"), filters.bedroomsMin()));
            }
            if (filters.bedroomsMax() != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("bedrooms"), filters.bedroomsMax()));
            }
            if (filters.yearBuiltMin() != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("yearBuilt"), filters.yearBuiltMin()));
            }
            if (filters.yearBuiltMax() != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("yearBuilt"), filters.yearBuiltMax()));
            }
            if (filters.distanceMax() != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("distanceToCityCenter"), filters.distanceMax()));
            }
            if (filters.schoolRatingMin() != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("schoolRating"), filters.schoolRatingMin()));
            }
            if (filters.schoolRatingMax() != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("schoolRating"), filters.schoolRatingMax()));
            }
            if (filters.priceMin() != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("price"), filters.priceMin()));
            }
            if (filters.priceMax() != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("price"), filters.priceMax()));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }
}

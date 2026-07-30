package com.portal.analytics.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link StatsFilters}.
 */
@DisplayName("StatsFilters")
class StatsFiltersTest {

    @Nested
    @DisplayName("isEmpty()")
    class IsEmpty {

        @Test
        @DisplayName("should return true when all filters are null")
        void allNull() {
            StatsFilters filters = new StatsFilters(null, null, null, null, null, null, null, null, null);
            assertThat(filters.isEmpty()).isTrue();
        }

        @Test
        @DisplayName("should return false when at least one filter is set")
        void oneSet() {
            StatsFilters filters = new StatsFilters(3, null, null, null, null, null, null, null, null);
            assertThat(filters.isEmpty()).isFalse();
        }

        @Test
        @DisplayName("should return false when distance_max is set to 0")
        void distanceZero() {
            StatsFilters filters = new StatsFilters(null, null, null, null, 0.0, null, null, null, null);
            assertThat(filters.isEmpty()).isFalse();
        }
    }

    @Nested
    @DisplayName("cacheKey()")
    class CacheKey {

        @Test
        @DisplayName("should return 'default' for empty filters")
        void emptyFilters() {
            StatsFilters filters = new StatsFilters(null, null, null, null, null, null, null, null, null);
            assertThat(filters.cacheKey()).isEqualTo("default");
        }

        @Test
        @DisplayName("should generate deterministic key for specific filters")
        void specificFilters() {
            StatsFilters filters = new StatsFilters(3, 5, 1980, 2000, 15.0, 5.0, 9.0, 100000.0, 500000.0);
            String key = filters.cacheKey();
            assertThat(key).isNotNull().isNotEmpty();
            // Same filters should produce same key
            assertThat(key).isEqualTo(filters.cacheKey());
        }

        @Test
        @DisplayName("should generate different keys for different filters")
        void differentFilters() {
            StatsFilters filters1 = new StatsFilters(2, 4, null, null, null, null, null, null, null);
            StatsFilters filters2 = new StatsFilters(3, 5, null, null, null, null, null, null, null);
            assertThat(filters1.cacheKey()).isNotEqualTo(filters2.cacheKey());
        }
    }
}
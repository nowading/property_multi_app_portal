package com.portal.analytics.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link PropertyFeatures} domain entity.
 */
@DisplayName("PropertyFeatures domain validation")
class PropertyFeaturesTest {

    private static final double VALID_SQUARE_FOOTAGE = 2000.0;
    private static final int VALID_BEDROOMS = 3;
    private static final double VALID_BATHROOMS = 2.0;
    private static final int VALID_YEAR_BUILT = 1995;
    private static final double VALID_LOT_SIZE = 6000.0;
    private static final double VALID_DISTANCE = 5.0;
    private static final double VALID_SCHOOL_RATING = 7.0;

    private PropertyFeatures validFeatures() {
        return new PropertyFeatures(
                VALID_SQUARE_FOOTAGE, VALID_BEDROOMS, VALID_BATHROOMS,
                VALID_YEAR_BUILT, VALID_LOT_SIZE, VALID_DISTANCE, VALID_SCHOOL_RATING
        );
    }

    @Test
    @DisplayName("should create valid features with all fields")
    void createValidFeatures() {
        PropertyFeatures features = validFeatures();

        assertThat(features.squareFootage()).isEqualTo(2000.0);
        assertThat(features.bedrooms()).isEqualTo(3);
        assertThat(features.bathrooms()).isEqualTo(2.0);
        assertThat(features.yearBuilt()).isEqualTo(1995);
        assertThat(features.lotSize()).isEqualTo(6000.0);
        assertThat(features.distanceToCityCenter()).isEqualTo(5.0);
        assertThat(features.schoolRating()).isEqualTo(7.0);
    }

    @Nested
    @DisplayName("square_footage validation")
    class SquareFootageValidation {

        @Test
        @DisplayName("should reject zero square footage")
        void rejectZero() {
            assertThatThrownBy(() ->
                    new PropertyFeatures(0, 3, 2, 1995, 6000, 5, 7)
            ).isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("square_footage must be > 0");
        }

        @Test
        @DisplayName("should reject negative square footage")
        void rejectNegative() {
            assertThatThrownBy(() ->
                    new PropertyFeatures(-100, 3, 2, 1995, 6000, 5, 7)
            ).isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("square_footage must be > 0");
        }
    }

    @Nested
    @DisplayName("bedrooms validation")
    class BedroomsValidation {

        @Test
        @DisplayName("should accept zero bedrooms (studio)")
        void acceptZero() {
            PropertyFeatures features = new PropertyFeatures(2000, 0, 1, 1995, 6000, 5, 7);
            assertThat(features.bedrooms()).isEqualTo(0);
        }

        @Test
        @DisplayName("should reject negative bedrooms")
        void rejectNegative() {
            assertThatThrownBy(() ->
                    new PropertyFeatures(2000, -1, 2, 1995, 6000, 5, 7)
            ).isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("bedrooms must be >= 0");
        }
    }

    @Nested
    @DisplayName("year_built validation")
    class YearBuiltValidation {

        @Test
        @DisplayName("should reject year before 1800")
        void rejectTooOld() {
            assertThatThrownBy(() ->
                    new PropertyFeatures(2000, 3, 2, 1799, 6000, 5, 7)
            ).isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("year_built must be >= 1800");
        }

        @Test
        @DisplayName("should accept current year")
        void acceptCurrentYear() {
            int currentYear = java.time.Year.now().getValue();
            PropertyFeatures features = new PropertyFeatures(2000, 3, 2, currentYear, 6000, 5, 7);
            assertThat(features.yearBuilt()).isEqualTo(currentYear);
        }

        @Test
        @DisplayName("should reject year after current year")
        void rejectFutureYear() {
            int futureYear = java.time.Year.now().getValue() + 2;
            assertThatThrownBy(() ->
                    new PropertyFeatures(2000, 3, 2, futureYear, 6000, 5, 7)
            ).isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("year_built must be <= ");
        }
    }

    @Nested
    @DisplayName("school_rating validation")
    class SchoolRatingValidation {

        @Test
        @DisplayName("should reject rating below 1")
        void rejectBelowMin() {
            assertThatThrownBy(() ->
                    new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 0.5)
            ).isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("school_rating must be >= 1");
        }

        @Test
        @DisplayName("should reject rating above 10")
        void rejectAboveMax() {
            assertThatThrownBy(() ->
                    new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 11)
            ).isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("school_rating must be <= 10");
        }

        @Test
        @DisplayName("should accept rating of 1 (minimum)")
        void acceptMinRating() {
            PropertyFeatures features = new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 1.0);
            assertThat(features.schoolRating()).isEqualTo(1.0);
        }

        @Test
        @DisplayName("should accept rating of 10 (maximum)")
        void acceptMaxRating() {
            PropertyFeatures features = new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 10.0);
            assertThat(features.schoolRating()).isEqualTo(10.0);
        }
    }
}
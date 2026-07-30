package com.portal.analytics.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link PropertyRow}.
 */
@DisplayName("PropertyRow")
class PropertyRowTest {

    @Test
    @DisplayName("should convert to PropertyFeatures")
    void toFeatures() {
        PropertyRow row = new PropertyRow(
                1, 2000.0, 3, 2.0, 1995, 6000.0, 5.0, 7.0, 250000.0
        );

        PropertyFeatures features = row.toFeatures();

        assertThat(features.squareFootage()).isEqualTo(2000.0);
        assertThat(features.bedrooms()).isEqualTo(3);
        assertThat(features.bathrooms()).isEqualTo(2.0);
        assertThat(features.yearBuilt()).isEqualTo(1995);
        assertThat(features.lotSize()).isEqualTo(6000.0);
        assertThat(features.distanceToCityCenter()).isEqualTo(5.0);
        assertThat(features.schoolRating()).isEqualTo(7.0);
    }

    @Test
    @DisplayName("should store all fields correctly")
    void storeFields() {
        PropertyRow row = new PropertyRow(
                42, 1500.0, 2, 1.5, 2000, 3000.0, 10.0, 5.0, 180000.0
        );

        assertThat(row.id()).isEqualTo(42);
        assertThat(row.squareFootage()).isEqualTo(1500.0);
        assertThat(row.bedrooms()).isEqualTo(2);
        assertThat(row.bathrooms()).isEqualTo(1.5);
        assertThat(row.yearBuilt()).isEqualTo(2000);
        assertThat(row.lotSize()).isEqualTo(3000.0);
        assertThat(row.distanceToCityCenter()).isEqualTo(10.0);
        assertThat(row.schoolRating()).isEqualTo(5.0);
        assertThat(row.price()).isEqualTo(180000.0);
    }
}
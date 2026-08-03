package com.portal.analytics.adapters.persistence;

import com.portal.analytics.domain.DatasetPage;
import com.portal.analytics.domain.PropertyRow;
import com.portal.analytics.domain.StatsFilters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@Import({MysqlDatasetPort.class, PropertySpecifications.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("MysqlDatasetPort Integration Tests")
class MysqlDatasetPortTest {

    @Autowired
    private MysqlDatasetPort mysqlDatasetPort;

    @Autowired
    private PropertyRepository propertyRepository;

    @BeforeEach
    void setUp() {
        if (propertyRepository.count() == 0) {
            List<PropertyEntity> entities = CsvDataLoader.loadEntities(CsvDataLoader.DEFAULT_RESOURCE);
            propertyRepository.saveAll(entities);
        }
    }

    @Test
    @DisplayName("should load all rows from database")
    void findAll() {
        List<PropertyRow> rows = mysqlDatasetPort.findAll();
        assertThat(rows).isNotEmpty();
        assertThat(rows.size()).isEqualTo(50);
    }

    @Test
    @DisplayName("should filter by bedrooms min")
    void filterByBedroomsMin() {
        StatsFilters filters = new StatsFilters(3, null, null, null, null, null, null, null, null);
        List<PropertyRow> filtered = mysqlDatasetPort.findByFilters(filters);

        assertThat(filtered).isNotEmpty();
        assertThat(filtered).allMatch(row -> row.bedrooms() >= 3);
    }

    @Test
    @DisplayName("should filter by bedrooms max")
    void filterByBedroomsMax() {
        StatsFilters filters = new StatsFilters(null, 2, null, null, null, null, null, null, null);
        List<PropertyRow> filtered = mysqlDatasetPort.findByFilters(filters);

        assertThat(filtered).isNotEmpty();
        assertThat(filtered).allMatch(row -> row.bedrooms() <= 2);
    }

    @Test
    @DisplayName("should filter by year built range")
    void filterByYearRange() {
        StatsFilters filters = new StatsFilters(null, null, 2000, 2010, null, null, null, null, null);
        List<PropertyRow> filtered = mysqlDatasetPort.findByFilters(filters);

        assertThat(filtered).isNotEmpty();
        assertThat(filtered).allMatch(row -> row.yearBuilt() >= 2000 && row.yearBuilt() <= 2010);
    }

    @Test
    @DisplayName("should filter by distance max")
    void filterByDistance() {
        StatsFilters filters = new StatsFilters(null, null, null, null, 5.0, null, null, null, null);
        List<PropertyRow> filtered = mysqlDatasetPort.findByFilters(filters);

        assertThat(filtered).isNotEmpty();
        assertThat(filtered).allMatch(row -> row.distanceToCityCenter() <= 5.0);
    }

    @Test
    @DisplayName("should filter by price range")
    void filterByPriceRange() {
        StatsFilters filters = new StatsFilters(null, null, null, null, null, null, null, 200000.0, 400000.0);
        List<PropertyRow> filtered = mysqlDatasetPort.findByFilters(filters);

        assertThat(filtered).isNotEmpty();
        assertThat(filtered).allMatch(row -> row.price() >= 200000.0 && row.price() <= 400000.0);
    }

    @Test
    @DisplayName("should return paginated results")
    void findPage() {
        StatsFilters emptyFilters = new StatsFilters(null, null, null, null, null, null, null, null, null);
        DatasetPage page1 = mysqlDatasetPort.findPage(emptyFilters, 1, 10);

        assertThat(page1.rows()).hasSize(10);
        assertThat(page1.total()).isEqualTo(50);
        assertThat(page1.page()).isEqualTo(1);
        assertThat(page1.pageSize()).isEqualTo(10);

        DatasetPage page6 = mysqlDatasetPort.findPage(emptyFilters, 6, 10);
        assertThat(page6.rows()).hasSize(0);
    }

    @Test
    @DisplayName("should count rows matching filters")
    void countByFilters() {
        StatsFilters filters = new StatsFilters(4, null, null, null, null, null, null, null, null);
        long count = mysqlDatasetPort.countByFilters(filters);

        assertThat(count).isGreaterThan(0);
    }

    @Test
    @DisplayName("should return empty list when no rows match")
    void noMatches() {
        StatsFilters filters = new StatsFilters(null, null, null, null, null, null, null, null, 50000.0);
        List<PropertyRow> filtered = mysqlDatasetPort.findByFilters(filters);

        assertThat(filtered).isEmpty();
    }

    @Test
    @DisplayName("should parse row correctly")
    void parseRow() {
        List<PropertyRow> rows = mysqlDatasetPort.findAll();
        PropertyRow first = rows.get(0);

        assertThat(first.id()).isEqualTo(1);
        assertThat(first.squareFootage()).isEqualTo(1540.0);
        assertThat(first.bedrooms()).isEqualTo(2);
        assertThat(first.bathrooms()).isEqualTo(1.5);
        assertThat(first.yearBuilt()).isEqualTo(1992);
        assertThat(first.lotSize()).isEqualTo(3800.0);
        assertThat(first.distanceToCityCenter()).isEqualTo(8.2);
        assertThat(first.schoolRating()).isEqualTo(6.5);
        assertThat(first.price()).isEqualTo(185000.0);
    }

    @Test
    @DisplayName("should combine multiple filters")
    void combinedFilters() {
        StatsFilters filters = new StatsFilters(3, null, null, null, 8.0, null, null, null, null);
        List<PropertyRow> filtered = mysqlDatasetPort.findByFilters(filters);

        assertThat(filtered).isNotEmpty();
        assertThat(filtered).allMatch(row -> row.bedrooms() >= 3 && row.distanceToCityCenter() <= 8.0);
    }
}

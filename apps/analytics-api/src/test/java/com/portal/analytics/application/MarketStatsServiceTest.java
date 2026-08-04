package com.portal.analytics.application;

import com.portal.analytics.adapters.persistence.TestCacheConfig;
import com.portal.analytics.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link MarketStatsService} with Caffeine test cache
 * and in-memory dataset port.
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("MarketStatsService (with cache)")
class MarketStatsServiceTest {

    @Autowired
    private MarketStatsService service;

    @Autowired
    private CacheManager cacheManager;

    @Autowired
    private DatasetPort datasetPort;

    @BeforeEach
    void setUp() {
        // Clear all caches before each test
        var cacheNames = cacheManager.getCacheNames();
        for (String name : cacheNames) {
            var cache = cacheManager.getCache(name);
            if (cache != null) {
                cache.clear();
            }
        }

        // Clear in-memory dataset before each test
        if (datasetPort instanceof TestCacheConfig.InMemoryDatasetPort inMemory) {
            inMemory.clear();
        }
    }

    @Test
    @DisplayName("should compute correct KPIs for sample data")
    void computeKpis() {
        List<PropertyRow> rows = List.of(
                new PropertyRow(1, 1500, 2, 1, 1990, 3000, 5, 6, 200000),
                new PropertyRow(2, 2000, 3, 2, 2000, 5000, 3, 8, 300000),
                new PropertyRow(3, 2500, 4, 2, 2010, 7000, 8, 7, 400000)
        );

        KpiSummary kpis = service.computeKpis(rows);

        assertThat(kpis.count()).isEqualTo(3);
        assertThat(kpis.avgPrice()).isEqualTo(300000.0);
        assertThat(kpis.medianPrice()).isEqualTo(300000.0);
        assertThat(kpis.minPrice()).isEqualTo(200000.0);
        assertThat(kpis.maxPrice()).isEqualTo(400000.0);
        assertThat(kpis.avgSquareFootage()).isEqualTo(2000.0);
        assertThat(kpis.avgPricePerSqFt()).isEqualTo(150.0);
    }

    @Test
    @DisplayName("should compute empty stats for empty dataset")
    void emptyDataset() {
        List<PropertyRow> rows = List.of();

        KpiSummary kpis = service.computeKpis(rows);

        assertThat(kpis.count()).isEqualTo(0);
        assertThat(kpis.avgPrice()).isEqualTo(0);
    }

    @Test
    @DisplayName("should generate histogram with correct bin counts")
    void computeHistogram() {
        List<PropertyRow> rows = List.of(
                new PropertyRow(1, 1000, 2, 1, 1990, 3000, 5, 6, 100000),
                new PropertyRow(2, 2000, 3, 2, 2000, 5000, 3, 8, 300000),
                new PropertyRow(3, 3000, 4, 2, 2010, 7000, 8, 7, 500000),
                new PropertyRow(4, 4000, 5, 3, 2020, 9000, 2, 9, 700000)
        );

        List<HistogramBin> histogram = service.computeHistogram(rows);

        assertThat(histogram).hasSize(10);
        assertThat(histogram.stream().mapToInt(HistogramBin::count).sum()).isEqualTo(4);
    }

    @Test
    @DisplayName("should compute box plot grouped by bedrooms")
    void computeBoxPlot() {
        List<PropertyRow> rows = List.of(
                new PropertyRow(1, 1000, 2, 1, 1990, 3000, 5, 6, 100000),
                new PropertyRow(2, 2000, 2, 2, 2000, 5000, 3, 8, 150000),
                new PropertyRow(3, 3000, 3, 2, 2010, 7000, 8, 7, 300000),
                new PropertyRow(4, 4000, 3, 3, 2020, 9000, 2, 9, 350000)
        );

        StatsFilters filters = new StatsFilters(null, null, null, null, null, null, null, null, null);
        List<BoxPlotGroup> boxPlot = service.computeBoxPlot(rows, filters);

        assertThat(boxPlot).hasSize(2);
        assertThat(boxPlot.get(0).bedrooms()).isEqualTo(2);
        assertThat(boxPlot.get(0).count()).isEqualTo(2);
        assertThat(boxPlot.get(1).bedrooms()).isEqualTo(3);
        assertThat(boxPlot.get(1).count()).isEqualTo(2);
    }

    @Test
    @DisplayName("should get aggregate stats with filters and cache results")
    void getAggregateStatsWithFilters() {
        // Given
        if (datasetPort instanceof TestCacheConfig.InMemoryDatasetPort inMemory) {
            inMemory.addRow(new PropertyRow(1, 1500, 2, 1, 1990, 3000, 5, 6, 200000));
            inMemory.addRow(new PropertyRow(2, 2000, 3, 2, 2000, 5000, 3, 8, 300000));
            inMemory.addRow(new PropertyRow(3, 2500, 4, 2, 2010, 7000, 8, 7, 400000));
        }

        StatsFilters filters = new StatsFilters(3, null, null, null, null, null, null, null, null);

        // When
        MarketStats stats = service.getAggregateStats(filters);

        // Then
        assertThat(stats.kpis().count()).isEqualTo(2);
        assertThat(stats.kpis().avgPrice()).isEqualTo(350000.0);

        // Second call should hit the cache
        MarketStats cachedStats = service.getAggregateStats(filters);
        assertThat(cachedStats.kpis().count()).isEqualTo(2);
    }
}

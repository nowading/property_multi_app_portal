package com.portal.analytics.application;

import com.portal.analytics.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link MarketStatsService}.
 */
@DisplayName("MarketStatsService")
class MarketStatsServiceTest {

    private MarketStatsService service;
    private InMemoryDatasetPort datasetPort;

    @BeforeEach
    void setUp() {
        datasetPort = new InMemoryDatasetPort();
        service = new MarketStatsService(datasetPort);
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
    @DisplayName("should get aggregate stats with filters")
    void getAggregateStatsWithFilters() {
        datasetPort.addRow(new PropertyRow(1, 1500, 2, 1, 1990, 3000, 5, 6, 200000));
        datasetPort.addRow(new PropertyRow(2, 2000, 3, 2, 2000, 5000, 3, 8, 300000));
        datasetPort.addRow(new PropertyRow(3, 2500, 4, 2, 2010, 7000, 8, 7, 400000));

        StatsFilters filters = new StatsFilters(3, null, null, null, null, null, null, null, null);
        MarketStats stats = service.getAggregateStats(filters);

        assertThat(stats.kpis().count()).isEqualTo(2);
        assertThat(stats.kpis().avgPrice()).isEqualTo(350000.0);
    }

    /**
     * Simple in-memory dataset port for testing.
     */
    private static class InMemoryDatasetPort implements DatasetPort {
        private final List<PropertyRow> rows = new ArrayList<>();

        void addRow(PropertyRow row) {
            rows.add(row);
        }

        @Override
        public List<PropertyRow> findAll() {
            return List.copyOf(rows);
        }

        @Override
        public List<PropertyRow> findByFilters(StatsFilters filters) {
            return rows.stream()
                    .filter(row -> matchesFilter(row, filters))
                    .toList();
        }

        @Override
        public DatasetPage findPage(StatsFilters filters, int page, int pageSize) {
            List<PropertyRow> filtered = findByFilters(filters);
            long total = filtered.size();
            int fromIndex = (page - 1) * pageSize;
            int toIndex = Math.min(fromIndex + pageSize, filtered.size());
            List<PropertyRow> pageRows = fromIndex >= total
                    ? List.of()
                    : filtered.subList(fromIndex, toIndex);
            return new DatasetPage(pageRows, total, page, pageSize);
        }

        @Override
        public long countByFilters(StatsFilters filters) {
            return findByFilters(filters).size();
        }

        private boolean matchesFilter(PropertyRow row, StatsFilters filters) {
            if (filters.bedroomsMin() != null && row.bedrooms() < filters.bedroomsMin()) return false;
            if (filters.bedroomsMax() != null && row.bedrooms() > filters.bedroomsMax()) return false;
            if (filters.yearBuiltMin() != null && row.yearBuilt() < filters.yearBuiltMin()) return false;
            if (filters.yearBuiltMax() != null && row.yearBuilt() > filters.yearBuiltMax()) return false;
            if (filters.distanceMax() != null && row.distanceToCityCenter() > filters.distanceMax()) return false;
            if (filters.schoolRatingMin() != null && row.schoolRating() < filters.schoolRatingMin()) return false;
            if (filters.schoolRatingMax() != null && row.schoolRating() > filters.schoolRatingMax()) return false;
            if (filters.priceMin() != null && row.price() < filters.priceMin()) return false;
            if (filters.priceMax() != null && row.price() > filters.priceMax()) return false;
            return true;
        }
    }
}
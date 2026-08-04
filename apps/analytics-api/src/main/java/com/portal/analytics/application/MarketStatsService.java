package com.portal.analytics.application;

import com.portal.analytics.adapters.persistence.CacheConfig;
import com.portal.analytics.domain.*;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service for computing aggregate market statistics from the property dataset.
 *
 * <p>This service orchestrates the {@link DatasetPort} to retrieve property
 * rows and computes KPIs, histograms, scatter plots, and box plots using
 * pure Java logic — no database or external analytics engine needed.
 *
 * <p>Results are cached in Redis for 10 minutes with key derived from filter criteria.
 */
@Service
public class MarketStatsService {

    private final DatasetPort datasetPort;

    /** Number of histogram bins for price distribution. */
    private static final int HISTOGRAM_BINS = 10;

    /** Maximum number of scatter points to include (for performance). */
    private static final int MAX_SCATTER_POINTS = 100;

    public MarketStatsService(DatasetPort datasetPort) {
        this.datasetPort = datasetPort;
    }

    /**
     * Compute aggregate market statistics with optional filters.
     * Results are cached in Redis using a hash of the filter criteria as cache key.
     *
     * @param filters optional filter criteria (may be null or empty)
     * @return complete market stats with KPIs, histogram, scatter, and box plot
     */
    @Cacheable(value = CacheConfig.STATS_CACHE, key = "#filters == null ? 'default' : #filters.cacheKey()")
    public MarketStats getAggregateStats(StatsFilters filters) {
        StatsFilters effectiveFilters = filters != null ? filters : new StatsFilters(
                null, null, null, null, null, null, null, null, null
        );

        return computeStats(effectiveFilters);
    }

    private MarketStats computeStats(StatsFilters filters) {
        List<PropertyRow> rows = filters.isEmpty()
                ? datasetPort.findAll()
                : datasetPort.findByFilters(filters);

        if (rows.isEmpty()) {
            return emptyStats(filters);
        }

        KpiSummary kpis = computeKpis(rows);
        List<HistogramBin> histogram = computeHistogram(rows);
        List<ScatterPoint> scatter = computeScatterPlot(rows);
        List<BoxPlotGroup> boxPlot = computeBoxPlot(rows, filters);

        return new MarketStats(kpis, histogram, scatter, boxPlot, filters);
    }

    /**
     * Compute KPI summary from property rows.
     */
    public KpiSummary computeKpis(List<PropertyRow> rows) {
        int count = rows.size();

        if (count == 0) {
            return new KpiSummary(0, 0, 0, 0, 0, 0, 0, 0);
        }

        double totalPrice = rows.stream().mapToDouble(PropertyRow::price).sum();
        double avgPrice = totalPrice / count;

        List<Double> sortedPrices = rows.stream()
                .map(PropertyRow::price)
                .sorted()
                .toList();

        double medianPrice = computeMedian(sortedPrices);
        double minPrice = sortedPrices.get(0);
        double maxPrice = sortedPrices.get(sortedPrices.size() - 1);

        double variance = rows.stream()
                .mapToDouble(row -> Math.pow(row.price() - avgPrice, 2))
                .sum() / count;
        double stdDevPrice = Math.sqrt(variance);

        double avgSqft = rows.stream()
                .mapToDouble(PropertyRow::squareFootage)
                .average()
                .orElse(0.0);

        double avgPricePerSqft = avgSqft > 0 ? avgPrice / avgSqft : 0.0;

        return new KpiSummary(
                count,
                Math.round(avgPrice * 100.0) / 100.0,
                Math.round(medianPrice * 100.0) / 100.0,
                minPrice,
                maxPrice,
                Math.round(stdDevPrice * 100.0) / 100.0,
                Math.round(avgSqft * 100.0) / 100.0,
                Math.round(avgPricePerSqft * 100.0) / 100.0
        );
    }

    /**
     * Compute price distribution histogram.
     */
    public List<HistogramBin> computeHistogram(List<PropertyRow> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }

        double minPrice = rows.stream().mapToDouble(PropertyRow::price).min().orElse(0);
        double maxPrice = rows.stream().mapToDouble(PropertyRow::price).max().orElse(1);
        double binWidth = (maxPrice - minPrice) / HISTOGRAM_BINS;

        List<HistogramBin> bins = new ArrayList<>();
        for (int i = 0; i < HISTOGRAM_BINS; i++) {
            final double rangeStart = minPrice + i * binWidth;
            final double rangeEnd = (i == HISTOGRAM_BINS - 1)
                    ? maxPrice
                    : minPrice + (i + 1) * binWidth;
            final boolean isLastBin = (i == HISTOGRAM_BINS - 1);

            long count = rows.stream()
                    .filter(row -> {
                        double price = row.price();
                        if (isLastBin) {
                            return price >= rangeStart && price <= rangeEnd;
                        }
                        return price >= rangeStart && price < rangeEnd;
                    })
                    .count();

            String label = String.format("$%dk–$%dk",
                    Math.round(rangeStart / 1000),
                    Math.round(rangeEnd / 1000));

            bins.add(new HistogramBin(label, (int) count, rangeStart, rangeEnd));
        }

        return bins;
    }

    /**
     * Compute price vs. square footage scatter plot (sampled).
     */
    public List<ScatterPoint> computeScatterPlot(List<PropertyRow> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }

        int sampleStep = Math.max(1, rows.size() / MAX_SCATTER_POINTS);
        List<ScatterPoint> points = new ArrayList<>();

        for (int i = 0; i < rows.size(); i += sampleStep) {
            PropertyRow row = rows.get(i);
            points.add(new ScatterPoint(row.squareFootage(), row.price(), row.bedrooms()));
        }

        return points;
    }

    /**
     * Compute box plot statistics grouped by bedroom count.
     */
    public List<BoxPlotGroup> computeBoxPlot(List<PropertyRow> rows, StatsFilters filters) {
        if (rows.isEmpty()) {
            return List.of();
        }

        int bedsMin = filters.bedroomsMin() != null ? filters.bedroomsMin() : rows.stream()
                .mapToInt(PropertyRow::bedrooms).min().orElse(1);
        int bedsMax = filters.bedroomsMax() != null ? filters.bedroomsMax() : rows.stream()
                .mapToInt(PropertyRow::bedrooms).max().orElse(6);

        Map<Integer, List<Double>> pricesByBedrooms = rows.stream()
                .collect(Collectors.groupingBy(
                        PropertyRow::bedrooms,
                        Collectors.mapping(PropertyRow::price, Collectors.toList())
                ));

        List<BoxPlotGroup> groups = new ArrayList<>();
        for (int beds = bedsMin; beds <= bedsMax; beds++) {
            List<Double> prices = pricesByBedrooms.get(beds);
            if (prices == null || prices.isEmpty()) {
                continue;
            }

            List<Double> sorted = prices.stream().sorted().toList();
            int n = sorted.size();

            groups.add(new BoxPlotGroup(
                    beds,
                    sorted.get(0),
                    sorted.get(n / 4),
                    sorted.get(n / 2),
                    sorted.get((3 * n) / 4),
                    sorted.get(n - 1),
                    n
            ));
        }

        return groups;
    }

    /**
     * Compute median from a sorted list.
     */
    private double computeMedian(List<Double> sortedValues) {
        int n = sortedValues.size();
        if (n == 0) {
            return 0.0;
        }
        if (n % 2 == 0) {
            return (sortedValues.get(n / 2 - 1) + sortedValues.get(n / 2)) / 2.0;
        } else {
            return sortedValues.get(n / 2);
        }
    }

    /**
     * Create an empty stats response for empty datasets.
     */
    private MarketStats emptyStats(StatsFilters filters) {
        KpiSummary emptyKpis = new KpiSummary(0, 0, 0, 0, 0, 0, 0, 0);
        return new MarketStats(emptyKpis, List.of(), List.of(), List.of(), filters);
    }
}
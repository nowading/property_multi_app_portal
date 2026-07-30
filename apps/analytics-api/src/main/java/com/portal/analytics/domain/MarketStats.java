package com.portal.analytics.domain;

import java.util.List;

/**
 * Aggregate market statistics response.
 *
 * @param kpis                key performance indicators
 * @param priceHistogram      price distribution histogram bins
 * @param priceVsSqft         price vs. square footage scatter plot points
 * @param boxPlotByBedrooms   box plot statistics grouped by bedroom count
 * @param filtersApplied      filters that were applied to generate these stats
 */
public record MarketStats(
        KpiSummary kpis,
        List<HistogramBin> priceHistogram,
        List<ScatterPoint> priceVsSqft,
        List<BoxPlotGroup> boxPlotByBedrooms,
        StatsFilters filtersApplied
) {
}
package com.portal.analytics.application;

import com.portal.analytics.domain.*;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service for segment analysis — comparing market statistics across
 * different property segments (e.g., by bedroom count, year built range).
 *
 * <p>This service uses the {@link DatasetPort} to query data and the
 * {@link MarketStatsService} to compute statistics for each segment.
 */
@Service
public class SegmentAnalysisService {

    private final DatasetPort datasetPort;
    private final MarketStatsService marketStatsService;

    public SegmentAnalysisService(DatasetPort datasetPort, MarketStatsService marketStatsService) {
        this.datasetPort = datasetPort;
        this.marketStatsService = marketStatsService;
    }

    /**
     * Get market stats for a specific bedroom-count segment.
     *
     * @param bedrooms bedroom count to filter by
     * @return market stats for the segment
     */
    public MarketStats getSegmentByBedrooms(int bedrooms) {
        StatsFilters filters = new StatsFilters(
                bedrooms, bedrooms, null, null, null, null, null, null, null
        );
        return marketStatsService.getAggregateStats(filters);
    }

    /**
     * Get market stats for a specific year-built segment.
     *
     * @param yearMin minimum year built (inclusive)
     * @param yearMax maximum year built (inclusive)
     * @return market stats for the segment
     */
    public MarketStats getSegmentByYearRange(int yearMin, int yearMax) {
        StatsFilters filters = new StatsFilters(
                null, null, yearMin, yearMax, null, null, null, null, null
        );
        return marketStatsService.getAggregateStats(filters);
    }

    /**
     * Get a comparison of average prices across bedroom segments.
     *
     * @param minBedrooms minimum bedrooms to include
     * @param maxBedrooms maximum bedrooms to include
     * @return array of average prices per bedroom count
     */
    public double[] getAvgPriceByBedroomSegment(int minBedrooms, int maxBedrooms) {
        double[] avgPrices = new double[maxBedrooms - minBedrooms + 1];

        for (int i = minBedrooms; i <= maxBedrooms; i++) {
            MarketStats segment = getSegmentByBedrooms(i);
            avgPrices[i - minBedrooms] = segment.kpis().avgPrice();
        }

        return avgPrices;
    }
}
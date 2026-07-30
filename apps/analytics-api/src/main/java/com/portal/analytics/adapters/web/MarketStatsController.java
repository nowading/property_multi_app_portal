package com.portal.analytics.adapters.web;

import com.portal.analytics.application.MarketStatsService;
import com.portal.analytics.domain.MarketStats;
import com.portal.analytics.domain.StatsFilters;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for market statistics endpoints.
 *
 * <p>Provides endpoints for aggregate stats, KPI summaries,
 * histogram data, scatter plots, and box plots.
 */
@RestController
@RequestMapping("/api/stats")
public class MarketStatsController {

    private static final Logger log = LoggerFactory.getLogger(MarketStatsController.class);

    private final MarketStatsService marketStatsService;

    public MarketStatsController(MarketStatsService marketStatsService) {
        this.marketStatsService = marketStatsService;
    }

    /**
     * Get aggregate market statistics with optional filters.
     */
    @GetMapping("/aggregate")
    public ApiResponse<MarketStats> getAggregateStats(
            @RequestParam(required = false) Integer bedroomsMin,
            @RequestParam(required = false) Integer bedroomsMax,
            @RequestParam(required = false) Integer yearBuiltMin,
            @RequestParam(required = false) Integer yearBuiltMax,
            @RequestParam(required = false) Double distanceMax,
            @RequestParam(required = false) Double schoolRatingMin,
            @RequestParam(required = false) Double schoolRatingMax,
            @RequestParam(required = false) Double priceMin,
            @RequestParam(required = false) Double priceMax
    ) {
        log.info("Getting aggregate stats with filters");

        StatsFilters filters = new StatsFilters(
                bedroomsMin, bedroomsMax,
                yearBuiltMin, yearBuiltMax,
                distanceMax,
                schoolRatingMin, schoolRatingMax,
                priceMin, priceMax
        );

        MarketStats stats = marketStatsService.getAggregateStats(filters);
        return ApiResponse.success(stats);
    }

    /**
     * Get aggregate stats with JSON filter body (POST).
     */
    @PostMapping("/aggregate")
    public ApiResponse<MarketStats> getAggregateStats(@RequestBody(required = false) StatsFilters filters) {
        log.info("Getting aggregate stats with JSON filters");

        MarketStats stats = marketStatsService.getAggregateStats(filters);
        return ApiResponse.success(stats);
    }
}
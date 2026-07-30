package com.portal.analytics.adapters.web;

import com.portal.analytics.application.MarketStatsService;
import com.portal.analytics.domain.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.StringWriter;
import java.io.PrintWriter;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * REST controller for data export endpoints.
 *
 * <p>Provides CSV export functionality for market statistics data.
 */
@RestController
@RequestMapping("/api/export")
public class ExportController {

    private static final Logger log = LoggerFactory.getLogger(ExportController.class);

    private final MarketStatsService marketStatsService;

    public ExportController(MarketStatsService marketStatsService) {
        this.marketStatsService = marketStatsService;
    }

    /**
     * Export aggregate statistics as CSV.
     */
    @GetMapping(value = "/stats/csv", produces = "text/csv")
    public ResponseEntity<String> exportStatsCsv(
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
        log.info("Exporting stats to CSV");

        StatsFilters filters = new StatsFilters(
                bedroomsMin, bedroomsMax,
                yearBuiltMin, yearBuiltMax,
                distanceMax,
                schoolRatingMin, schoolRatingMax,
                priceMin, priceMax
        );

        MarketStats stats = marketStatsService.getAggregateStats(filters);
        String csvContent = generateCsv(stats);

        String filename = URLEncoder.encode("market-stats.csv", StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csvContent);
    }

    private String generateCsv(MarketStats stats) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);

        // Header section
        pw.println("Market Statistics Report");
        pw.println("========================");
        pw.println();

        // KPIs section
        pw.println("Key Performance Indicators");
        pw.println("--------------------------");
        pw.println("Metric,Value");
        KpiSummary kpis = stats.kpis();
        pw.printf("Total Properties,%d%n", kpis.count());
        pw.printf("Average Price,%.2f%n", kpis.avgPrice());
        pw.printf("Median Price,%.2f%n", kpis.medianPrice());
        pw.printf("Minimum Price,%.2f%n", kpis.minPrice());
        pw.printf("Maximum Price,%.2f%n", kpis.maxPrice());
        pw.printf("Std Deviation,%.2f%n", kpis.stdDevPrice());
        pw.printf("Average Sq Ft,%.2f%n", kpis.avgSquareFootage());
        pw.printf("Average Price/Sq Ft,%.2f%n", kpis.avgPricePerSqFt());
        pw.println();

        // Histogram section
        pw.println("Price Distribution Histogram");
        pw.println("-----------------------------");
        pw.println("Price Range,Count");
        for (HistogramBin bin : stats.priceHistogram()) {
            pw.printf("%s,%d%n", bin.range(), bin.count());
        }
        pw.println();

        // Box plot section
        pw.println("Box Plot by Bedrooms");
        pw.println("--------------------");
        pw.println("Bedrooms,Min,Q1,Median,Q3,Max,Count");
        for (BoxPlotGroup group : stats.boxPlotByBedrooms()) {
            pw.printf("%d,%.0f,%.0f,%.0f,%.0f,%.0f,%d%n",
                    group.bedrooms(),
                    group.min(),
                    group.q1(),
                    group.median(),
                    group.q3(),
                    group.max(),
                    group.count());
        }

        return sw.toString();
    }
}
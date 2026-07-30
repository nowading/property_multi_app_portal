package com.portal.analytics.adapters.persistence;

import com.portal.analytics.domain.*;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * CSV-backed implementation of {@link DatasetPort}.
 *
 * <p>Loads housing.csv from classpath resources at startup into an
 * in-memory list and exposes query/filter/pagination methods.
 * Thread-safe via ConcurrentHashMap for filtered counts.
 */
@Component
public class CsvDatasetPort implements DatasetPort {

    private static final Logger log = LoggerFactory.getLogger(CsvDatasetPort.class);

    private static final String CSV_RESOURCE = "data/housing.csv";

    /** Precomputed median features for default baseline. */
    private static final PropertyFeatures DEFAULT_BASELINE = new PropertyFeatures(
            2000, 3, 2, 1995, 6000, 5, 7
    );

    private final List<PropertyRow> rows = new ArrayList<>();
    private final Map<String, Long> filterCountsCache = new ConcurrentHashMap<>();

    /**
     * Load CSV data from classpath resource on startup.
     */
    @PostConstruct
    public void init() {
        try {
            loadCsvData();
            log.info("Loaded {} property rows from {}", rows.size(), CSV_RESOURCE);
        } catch (IOException e) {
            log.error("Failed to load CSV data from {}", CSV_RESOURCE, e);
            throw new RuntimeException("Failed to initialize dataset", e);
        }
    }

    private void loadCsvData() throws IOException {
        ClassPathResource resource = new ClassPathResource(CSV_RESOURCE);
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {

            // Skip header line
            String header = reader.readLine();
            if (header == null) {
                log.warn("Empty CSV file: {}", CSV_RESOURCE);
                return;
            }

            String line;
            int rowCount = 0;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) {
                    continue;
                }
                try {
                    PropertyRow row = parseRow(line, ++rowCount);
                    rows.add(row);
                } catch (NumberFormatException e) {
                    log.warn("Skipping malformed CSV line {}: {}", rowCount, line);
                }
            }
        }
    }

    private PropertyRow parseRow(String line, int expectedId) {
        String[] parts = line.split(",");
        if (parts.length < 9) {
            throw new NumberFormatException("Expected 9 columns, got " + parts.length);
        }

        return new PropertyRow(
                Integer.parseInt(parts[0].trim()),
                Double.parseDouble(parts[1].trim()),
                Integer.parseInt(parts[2].trim()),
                Double.parseDouble(parts[3].trim()),
                Integer.parseInt(parts[4].trim()),
                Double.parseDouble(parts[5].trim()),
                Double.parseDouble(parts[6].trim()),
                Double.parseDouble(parts[7].trim()),
                Double.parseDouble(parts[8].trim())
        );
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

        List<PropertyRow> pageRows;
        if (fromIndex >= total) {
            pageRows = List.of();
        } else {
            pageRows = filtered.subList(fromIndex, toIndex);
        }

        return new DatasetPage(pageRows, total, page, pageSize);
    }

    @Override
    public long countByFilters(StatsFilters filters) {
        String cacheKey = filters.cacheKey();
        return filterCountsCache.computeIfAbsent(cacheKey,
                key -> rows.stream().filter(row -> matchesFilter(row, filters)).count());
    }

    /**
     * Clear the filter counts cache (useful for testing).
     */
    public void clearCache() {
        filterCountsCache.clear();
    }

    private boolean matchesFilter(PropertyRow row, StatsFilters filters) {
        if (filters == null || filters.isEmpty()) {
            return true;
        }
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
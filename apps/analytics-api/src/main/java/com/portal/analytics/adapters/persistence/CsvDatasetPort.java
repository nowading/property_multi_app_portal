package com.portal.analytics.adapters.persistence;

import com.portal.analytics.domain.*;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * CSV-backed fallback implementation of {@link DatasetPort}.
 *
 * <p>Loads housing.csv from classpath resources at startup into an
 * in-memory list and exposes query/filter/pagination methods.
 * Thread-safe via ConcurrentHashMap for filtered counts.</p>
 *
 * <p>Activated ONLY when the {@code csv} Spring profile is explicitly
 * selected (e.g. {@code spring.profiles.active=csv}). Combined with
 * MySQL being the primary (via {@code @Primary} on {@link MysqlDatasetPort}),
 * this prevents the CSV port from being accidentally used in production
 * while still allowing local/demo deployments to opt-in.</p>
 */
@Component
@Profile("csv")
public class CsvDatasetPort implements DatasetPort {

    private static final Logger log = LoggerFactory.getLogger(CsvDatasetPort.class);

    private final List<PropertyRow> rows = new ArrayList<>();
    private final Map<String, Long> filterCountsCache = new ConcurrentHashMap<>();

    /**
     * Load CSV data from classpath resource on startup.
     */
    @PostConstruct
    public void init() {
        List<PropertyRow> loaded = CsvDataLoader.loadRows(CsvDataLoader.DEFAULT_RESOURCE);
        rows.addAll(loaded);
        log.info("Loaded {} property rows from {}", rows.size(), CsvDataLoader.DEFAULT_RESOURCE);
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

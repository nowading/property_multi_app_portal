package com.portal.analytics.adapters.persistence;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.portal.analytics.domain.*;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Test-profile cache configuration using Caffeine for local in-memory caching.
 *
 * <p>Active only when {@code spring.profiles.active=test}.
 * Provides the same named caches as production (stats, modelInfo, whatIf)
 * but with Caffeine-backed storage — no Redis connection required.
 * Also provides an {@link InMemoryDatasetPort} as the {@link DatasetPort} bean
 * for service-layer tests that need a dataset port implementation.
 */
@Configuration
@Profile("test")
public class TestCacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();

        cacheManager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(10))
                .maximumSize(1000)
                .recordStats());

        return cacheManager;
    }

    @Bean
    @Primary
    public DatasetPort datasetPort() {
        return new InMemoryDatasetPort();
    }

    /**
     * In-memory implementation of {@link DatasetPort} for testing.
     * Data is stored in an ArrayList and reset between test runs.
     */
    public static class InMemoryDatasetPort implements DatasetPort {
        private final List<PropertyRow> rows = new ArrayList<>();

        public void addRow(PropertyRow row) {
            rows.add(row);
        }

        public void clear() {
            rows.clear();
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

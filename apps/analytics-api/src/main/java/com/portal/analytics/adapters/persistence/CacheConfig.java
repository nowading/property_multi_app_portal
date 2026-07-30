package com.portal.analytics.adapters.persistence;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.portal.analytics.domain.MarketStats;
import com.portal.analytics.domain.ModelInfo;
import com.portal.analytics.domain.WhatIfResult;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Caffeine cache configuration for analytics services.
 *
 * <p>Defines three named caches per the caching strategy in PROJECT_PLAN.md §3.1:
 * <ul>
 *   <li>{@code stats} — TTL 10 min, max 1000 entries, key = filters hash</li>
 *   <li>{@code modelInfo} — TTL 60 s, max 1 entry (single model info)</li>
 *   <li>{@code whatIf} — TTL 60 s, max 500 entries, key = features hash</li>
 * </ul>
 */
@Configuration
public class CacheConfig {

    public static final String STATS_CACHE = "stats";
    public static final String MODEL_INFO_CACHE = "modelInfo";
    public static final String WHAT_IF_CACHE = "whatIf";

    /**
     * Cache for aggregate market stats (filtered by different filter combinations).
     */
    @Bean(name = STATS_CACHE)
    public Cache<String, MarketStats> statsCache() {
        return Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(10))
                .maximumSize(1000)
                .recordStats()
                .build();
    }

    /**
     * Cache for ML model metadata (rarely changes).
     */
    @Bean(name = MODEL_INFO_CACHE)
    public Cache<String, ModelInfo> modelInfoCache() {
        return Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(60))
                .maximumSize(1)
                .recordStats()
                .build();
    }

    /**
     * Cache for what-if prediction results.
     */
    @Bean(name = WHAT_IF_CACHE)
    public Cache<String, WhatIfResult> whatIfCache() {
        return Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(60))
                .maximumSize(500)
                .recordStats()
                .build();
    }
}
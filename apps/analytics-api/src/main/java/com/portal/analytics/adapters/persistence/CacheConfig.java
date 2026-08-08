package com.portal.analytics.adapters.persistence;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Redis distributed cache configuration for analytics services.
 *
 * <p>Defines three named caches with specific TTLs:
 * <ul>
 *   <li>{@code stats} — TTL 10 min, for aggregate market statistics</li>
 *   <li>{@code modelInfo} — TTL 60 s, for ML model metadata</li>
 *   <li>{@code whatIf} — TTL 60 s, for what-if prediction results</li>
 * </ul>
 *
 * <p>Uses Jackson JSON serialization for human-readable cache entries
 * and cross-service compatibility.
 */
@Configuration
@EnableCaching
@Profile("!test")
public class CacheConfig {

    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

    public static final String STATS_CACHE = "stats";
    public static final String MODEL_INFO_CACHE = "modelInfo";
    public static final String WHAT_IF_CACHE = "whatIf";

    @Value("${portal.cache.enabled:true}")
    private boolean cacheEnabled;

    /**
     * RedisCacheManager with per-cache TTL and Jackson JSON serialization.
     */
    @Bean
    @Primary
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        mapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.EVERYTHING,
                JsonTypeInfo.As.PROPERTY
        );

        GenericJackson2JsonRedisSerializer jsonSerializer =
                new GenericJackson2JsonRedisSerializer(mapper);
        StringRedisSerializer stringSerializer = new StringRedisSerializer();

        RedisSerializationContext.SerializationPair jsonPair =
                RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer);
        RedisSerializationContext.SerializationPair stringPair =
                RedisSerializationContext.SerializationPair.fromSerializer(stringSerializer);

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))
                .serializeKeysWith(stringPair)
                .serializeValuesWith(jsonPair)
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();

        cacheConfigurations.put(STATS_CACHE, defaultConfig.entryTtl(Duration.ofMinutes(10)));
        cacheConfigurations.put(MODEL_INFO_CACHE, defaultConfig.entryTtl(Duration.ofSeconds(60)));
        cacheConfigurations.put(WHAT_IF_CACHE, defaultConfig.entryTtl(Duration.ofSeconds(60)));

        if (!cacheEnabled) {
            log.warn("Redis caching is DISABLED via portal.cache.enabled=false — all @Cacheable methods will bypass the cache");
            return new org.springframework.cache.support.NoOpCacheManager();
        }

        log.info("Redis caching ENABLED — connecting to Redis for distributed cache");

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigurations)
                .transactionAware()
                .build();
    }
}
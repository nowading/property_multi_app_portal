package com.portal.analytics.adapters.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Component;

/**
 * Health indicator for the Redis distributed cache service.
 *
 * <p>Monitors Redis connectivity and reports status through Spring Boot Actuator.
 * When cache is disabled (portal.cache.enabled=false), reports UP with a note.
 */
@Component
public class RedisHealthIndicator implements HealthIndicator {

    private static final Logger log = LoggerFactory.getLogger(RedisHealthIndicator.class);

    private final RedisConnectionFactory connectionFactory;
    private final boolean cacheEnabled;

    public RedisHealthIndicator(RedisConnectionFactory connectionFactory,
                                @Value("${portal.cache.enabled:true}") boolean cacheEnabled) {
        this.connectionFactory = connectionFactory;
        this.cacheEnabled = cacheEnabled;
    }

    @Override
    public Health health() {
        if (!cacheEnabled) {
            return Health.up()
                    .withDetail("status", "Redis caching is DISABLED — cache bypassed by configuration")
                    .withDetail("note", "Set portal.cache.enabled=true to enable Redis caching")
                    .build();
        }

        try (RedisConnection connection = connectionFactory.getConnection()) {
            String pong = connection.ping();

            if ("PONG".equalsIgnoreCase(pong)) {
                return Health.up()
                        .withDetail("status", "Redis cache is healthy")
                        .withDetail("ping", "PONG")
                        .build();
            } else {
                return Health.down()
                        .withDetail("status", "Redis ping returned unexpected response: " + pong)
                        .build();
            }
        } catch (Exception e) {
            log.warn("Redis health check failed: {}", e.getMessage());
            return Health.down()
                    .withDetail("status", "Redis cache is unreachable")
                    .withDetail("error", e.getMessage())
                    .withDetail("action", "Check Redis container status, network connectivity, and password configuration")
                    .build();
        }
    }
}
package com.portal.analytics.adapters.web;

import com.portal.analytics.domain.HealthPort;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * Health indicator for the ML model container.
 *
 * <p>Monitors the availability of the ML inference service
 * and reports its status through Spring Boot Actuator.
 */
@Component
public class MlServiceHealthIndicator implements HealthIndicator {

    private final HealthPort healthPort;

    public MlServiceHealthIndicator(HealthPort healthPort) {
        this.healthPort = healthPort;
    }

    @Override
    public Health health() {
        boolean healthy = healthPort.isHealthy();

        if (healthy) {
            return Health.up()
                    .withDetail("status", "ML service is healthy (dev mode)")
                    .withDetail("endpoint", "/health")
                    .build();
        } else {
            return Health.down()
                    .withDetail("status", "ML service is unreachable")
                    .withDetail("endpoint", "/health")
                    .withDetail("action", "Prediction requests will fail with error until ML service recovers")
                    .build();
        }
    }
}
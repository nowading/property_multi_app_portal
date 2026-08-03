package com.portal.analytics.adapters.web;

import com.portal.analytics.domain.HealthPort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Integration tests for {@link MlServiceHealthIndicator}.
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("MlServiceHealthIndicator")
class MlServiceHealthIndicatorTest {

    @Autowired
    private HealthIndicator mlServiceHealthIndicator;

    @MockBean
    private HealthPort healthPort;

    @Test
    @DisplayName("should report UP when ML service is healthy")
    void healthy() {
        when(healthPort.isHealthy()).thenReturn(true);

        Health health = mlServiceHealthIndicator.health();

        assertThat(health.getStatus()).isEqualTo(org.springframework.boot.actuate.health.Status.UP);
        assertThat(health.getDetails()).containsEntry("status", "ML service is healthy");
    }

    @Test
    @DisplayName("should report DOWN when ML service is unhealthy")
    void unhealthy() {
        when(healthPort.isHealthy()).thenReturn(false);

        Health health = mlServiceHealthIndicator.health();

        assertThat(health.getStatus()).isEqualTo(org.springframework.boot.actuate.health.Status.DOWN);
        assertThat(health.getDetails()).containsEntry("status", "ML service is unreachable");
        assertThat(health.getDetails()).containsEntry("action", "Prediction requests will fail with error until ML service recovers");
    }
}
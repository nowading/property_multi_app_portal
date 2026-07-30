package com.portal.analytics.domain;

/**
 * Port for checking downstream service health.
 *
 * <p>Used by the health actuator endpoint to report the status
 * of the ML model container.
 */
public interface HealthPort {

    /**
     * Check if the downstream service is healthy.
     *
     * @return true if the service responds positively
     */
    boolean isHealthy();
}
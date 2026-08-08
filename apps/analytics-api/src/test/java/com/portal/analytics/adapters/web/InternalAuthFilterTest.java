package com.portal.analytics.adapters.web;

import com.portal.analytics.domain.HealthPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for the service-to-service auth filter
 * ({@link InternalAuthFilter}) and its {@link InternalAuthFilterConfig}
 * registration.
 *
 * <p>Loads the full Spring context (so the filter chain is wired) and uses
 * MockMvc to verify that the filter enforces {@code x-internal-token} on
 * non-health endpoints while leaving Actuator probes exempt.
 *
 * <p>The test profile ({@code application-test.yml}) configures
 * {@code internal.service.token=test-internal-token-for-unit-tests} so the
 * filter runs in enforcement mode.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "internal.service.token=test-internal-token-for-unit-tests"
})
@DisplayName("InternalAuthFilter")
class InternalAuthFilterTest {

    private static final String VALID_TOKEN = "test-internal-token-for-unit-tests";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private HealthPort healthPort;

    @BeforeEach
    void mockHealthyMl() {
        // The MlServiceHealthIndicator would otherwise mark the app DOWN because the
        // real ML container is not running during tests. We only care about the
        // auth filter's behavior, not actual health, so stub it as healthy.
        when(healthPort.isHealthy()).thenReturn(true);
    }

    @Test
    @DisplayName("GET /actuator/health without token returns 200 (exempt path)")
    void healthEndpointAllowedWithoutToken() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("GET /api/stats without token returns 401 with envelope")
    void protectedEndpointBlockedWithoutToken() throws Exception {
        mockMvc.perform(get("/api/stats"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.error.message").value("Missing internal service token"));
    }

    @Test
    @DisplayName("GET /api/stats with correct token returns 200")
    void protectedEndpointAllowedWithCorrectToken() throws Exception {
        mockMvc.perform(get("/api/stats").header("x-internal-token", VALID_TOKEN))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("GET /api/stats with wrong token returns 401")
    void protectedEndpointBlockedWithWrongToken() throws Exception {
        mockMvc.perform(get("/api/stats").header("x-internal-token", "definitely-not-the-right-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.error.message").value("Invalid internal service token"));
    }

    @Test
    @DisplayName("GET /api/stats with empty token header returns 401")
    void protectedEndpointBlockedWithEmptyToken() throws Exception {
        mockMvc.perform(get("/api/stats").header("x-internal-token", ""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.error.message").value("Missing internal service token"));
    }

    @Test
    @DisplayName("GET /actuator/info without token returns 200 (exempt path)")
    void infoEndpointAllowedWithoutToken() throws Exception {
        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isOk());
    }
}

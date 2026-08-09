package com.portal.analytics.adapters.web;

import com.portal.analytics.application.WhatIfAnalysisService;
import com.portal.analytics.domain.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for {@link WhatIfAnalysisController}.
 *
 * <p>The {@link InternalAuthFilter} is excluded via
 * {@code @AutoConfigureMockMvc(addFilters = false)} because this slice
 * test only cares about controller wiring — the filter's behaviour is
 * covered end-to-end by {@link InternalAuthFilterTest}.
 */
@WebMvcTest(WhatIfAnalysisController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("WhatIfAnalysisController")
class WhatIfAnalysisControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private WhatIfAnalysisService whatIfAnalysisService;

    @Test
    @DisplayName("POST /api/what-if/analyze should return what-if result")
    void analyze() throws Exception {
        PropertyFeatures modified = new PropertyFeatures(3000, 4, 2, 2000, 8000, 3, 8);
        WhatIfResult mockResult = new WhatIfResult(500000.0, 350000.0, 150000.0, 42.86, modified);

        when(whatIfAnalysisService.analyze(any(PropertyFeatures.class), any(PropertyFeatures.class)))
                .thenReturn(mockResult);

        String requestJson = """
                {
                    "squareFootage": 3000,
                    "bedrooms": 4,
                    "bathrooms": 2,
                    "yearBuilt": 2000,
                    "lotSize": 8000,
                    "distanceToCityCenter": 3,
                    "schoolRating": 8,
                    "baseline": {
                        "squareFootage": 2000,
                        "bedrooms": 3,
                        "bathrooms": 2,
                        "yearBuilt": 1995,
                        "lotSize": 6000,
                        "distanceToCityCenter": 5,
                        "schoolRating": 7
                    }
                }
                """;

        mockMvc.perform(post("/api/what-if/analyze")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.predictedPrice").value(500000.0))
                .andExpect(jsonPath("$.data.delta").value(150000.0));
    }

    @Test
    @DisplayName("POST /api/what-if/analyze-default should use default baseline")
    void analyzeWithDefault() throws Exception {
        PropertyFeatures modified = new PropertyFeatures(2500, 3, 2, 2000, 7000, 4, 7);
        WhatIfResult mockResult = new WhatIfResult(420000.0, 380000.0, 40000.0, 10.53, modified);

        when(whatIfAnalysisService.analyzeWithDefaultBaseline(any(PropertyFeatures.class)))
                .thenReturn(mockResult);

        String requestJson = """
                {
                    "squareFootage": 2500,
                    "bedrooms": 3,
                    "bathrooms": 2,
                    "yearBuilt": 2000,
                    "lotSize": 7000,
                    "distanceToCityCenter": 4,
                    "schoolRating": 7
                }
                """;

        mockMvc.perform(post("/api/what-if/analyze-default")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("should handle validation errors")
    void handleValidationError() throws Exception {
        when(whatIfAnalysisService.analyze(any(PropertyFeatures.class), any(PropertyFeatures.class)))
                .thenThrow(new IllegalArgumentException("Invalid features: square_footage must be > 0"));

        String requestJson = """
                {
                    "squareFootage": -100,
                    "bedrooms": 3,
                    "bathrooms": 2,
                    "yearBuilt": 2000,
                    "lotSize": 7000,
                    "distanceToCityCenter": 4,
                    "schoolRating": 7
                }
                """;

        mockMvc.perform(post("/api/what-if/analyze")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }
}
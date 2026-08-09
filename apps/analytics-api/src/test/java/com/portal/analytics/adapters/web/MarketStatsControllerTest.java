package com.portal.analytics.adapters.web;

import com.portal.analytics.application.MarketStatsService;
import com.portal.analytics.domain.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for {@link MarketStatsController}.
 *
 * <p>The {@link InternalAuthFilter} is excluded via
 * {@code @AutoConfigureMockMvc(addFilters = false)} because this slice
 * test only cares about controller wiring — the filter's behaviour is
 * covered end-to-end by {@link InternalAuthFilterTest}.
 */
@WebMvcTest(MarketStatsController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("MarketStatsController")
class MarketStatsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private MarketStatsService marketStatsService;

    @Test
    @DisplayName("GET /api/stats/aggregate should return stats with filters")
    void getAggregateStatsWithFilters() throws Exception {
        MarketStats mockStats = createMockStats();
        when(marketStatsService.getAggregateStats(any(StatsFilters.class))).thenReturn(mockStats);

        mockMvc.perform(get("/api/stats/aggregate")
                        .param("bedroomsMin", "3")
                        .param("priceMax", "500000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").exists())
                .andExpect(jsonPath("$.data.kpis.count").value(100));
    }

    @Test
    @DisplayName("GET /api/stats/aggregate should return default stats without filters")
    void getAggregateStatsNoFilters() throws Exception {
        MarketStats mockStats = createMockStats();
        when(marketStatsService.getAggregateStats(any(StatsFilters.class))).thenReturn(mockStats);

        mockMvc.perform(get("/api/stats/aggregate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("POST /api/stats/aggregate should accept JSON body")
    void postAggregateStats() throws Exception {
        MarketStats mockStats = createMockStats();
        when(marketStatsService.getAggregateStats(any(StatsFilters.class))).thenReturn(mockStats);

        String filterJson = """
                {
                    "bedroomsMin": 3,
                    "bedroomsMax": 5,
                    "priceMin": 300000
                }
                """;

        mockMvc.perform(post("/api/stats/aggregate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(filterJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("should handle validation errors gracefully")
    void handleValidationError() throws Exception {
        when(marketStatsService.getAggregateStats(any(StatsFilters.class)))
                .thenThrow(new IllegalArgumentException("Invalid filter: priceMax must be positive"));

        mockMvc.perform(get("/api/stats/aggregate")
                        .param("priceMax", "-1000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    private MarketStats createMockStats() {
        KpiSummary kpis = new KpiSummary(100, 350000.0, 320000.0, 150000.0, 600000.0, 85000.0, 2200.0, 159.0);
        List<HistogramBin> histogram = List.of(new HistogramBin("$150k–$200k", 10, 150000.0, 200000.0));
        List<ScatterPoint> scatter = List.of(new ScatterPoint(2000.0, 350000.0, 3));
        List<BoxPlotGroup> boxPlot = List.of(new BoxPlotGroup(3, 150000.0, 250000.0, 320000.0, 400000.0, 600000.0, 50));
        return new MarketStats(kpis, histogram, scatter, boxPlot, null);
    }
}
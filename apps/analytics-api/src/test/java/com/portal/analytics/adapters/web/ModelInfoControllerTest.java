package com.portal.analytics.adapters.web;

import com.portal.analytics.application.ModelInfoService;
import com.portal.analytics.domain.ModelInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for {@link ModelInfoController}.
 *
 * <p>The {@link InternalAuthFilter} is excluded via
 * {@code @AutoConfigureMockMvc(addFilters = false)} because this slice
 * test only cares about controller wiring — the filter's behaviour is
 * covered end-to-end by {@link InternalAuthFilterTest}.
 */
@WebMvcTest(ModelInfoController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ModelInfoController")
class ModelInfoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ModelInfoService modelInfoService;

    @Test
    @DisplayName("GET /api/model/info should return model info")
    void getModelInfo() throws Exception {
        ModelInfo mockInfo = new ModelInfo(
                "house-price-prediction",
                "1.0.0",
                "House price prediction model",
                List.of("square_footage", "bedrooms", "bathrooms", "year_built",
                        "lot_size", "distance_to_city_center", "school_rating"),
                "price"
        );

        when(modelInfoService.getModelInfo()).thenReturn(mockInfo);

        mockMvc.perform(get("/api/model/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.modelName").value("house-price-prediction"))
                .andExpect(jsonPath("$.data.modelVersion").value("1.0.0"));
    }

    @Test
    @DisplayName("DELETE /api/model/cache should clear cache")
    void clearCache() throws Exception {
        doNothing().when(modelInfoService).clearCache();

        mockMvc.perform(delete("/api/model/cache"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
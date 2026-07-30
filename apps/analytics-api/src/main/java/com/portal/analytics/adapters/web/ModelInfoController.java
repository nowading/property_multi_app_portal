package com.portal.analytics.adapters.web;

import com.portal.analytics.application.ModelInfoService;
import com.portal.analytics.domain.ModelInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for model information endpoints.
 */
@RestController
@RequestMapping("/api/model")
public class ModelInfoController {

    private static final Logger log = LoggerFactory.getLogger(ModelInfoController.class);

    private final ModelInfoService modelInfoService;

    public ModelInfoController(ModelInfoService modelInfoService) {
        this.modelInfoService = modelInfoService;
    }

    /**
     * Get ML model metadata.
     */
    @GetMapping("/info")
    public ApiResponse<ModelInfo> getModelInfo() {
        log.info("Getting model info");

        ModelInfo info = modelInfoService.getModelInfo();
        return ApiResponse.success(info);
    }

    /**
     * Clear the model info cache.
     */
    @DeleteMapping("/cache")
    public ApiResponse<String> clearCache() {
        log.info("Clearing model info cache");

        modelInfoService.clearCache();
        return ApiResponse.success("Cache cleared successfully");
    }
}
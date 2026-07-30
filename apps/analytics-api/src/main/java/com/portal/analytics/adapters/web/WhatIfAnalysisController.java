package com.portal.analytics.adapters.web;

import com.portal.analytics.application.WhatIfAnalysisService;
import com.portal.analytics.domain.PropertyFeatures;
import com.portal.analytics.domain.WhatIfResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for what-if analysis endpoints.
 *
 * <p>Provides endpoints for running what-if scenarios
 * by modifying property features and comparing against a baseline.
 */
@RestController
@RequestMapping("/api/what-if")
public class WhatIfAnalysisController {

    private static final Logger log = LoggerFactory.getLogger(WhatIfAnalysisController.class);

    private final WhatIfAnalysisService whatIfAnalysisService;

    public WhatIfAnalysisController(WhatIfAnalysisService whatIfAnalysisService) {
        this.whatIfAnalysisService = whatIfAnalysisService;
    }

    /**
     * Run what-if analysis with custom baseline.
     *
     * <p>Endpoint alias at {@code /api/what-if} (for Next.js frontend) and
     * {@code /api/what-if/analyze} (for clarity / future expansion).
     */
    @PostMapping({"", "/analyze"})
    public ApiResponse<WhatIfResult> analyze(
            @RequestBody WhatIfRequest request
    ) {
        log.info("Running what-if analysis");

        PropertyFeatures modified = new PropertyFeatures(
                request.squareFootage(),
                request.bedrooms(),
                request.bathrooms(),
                request.yearBuilt(),
                request.lotSize(),
                request.distanceToCityCenter(),
                request.schoolRating()
        );

        PropertyFeatures baseline = null;
        if (request.baseline() != null) {
            baseline = new PropertyFeatures(
                    request.baseline().squareFootage(),
                    request.baseline().bedrooms(),
                    request.baseline().bathrooms(),
                    request.baseline().yearBuilt(),
                    request.baseline().lotSize(),
                    request.baseline().distanceToCityCenter(),
                    request.baseline().schoolRating()
            );
        }

        WhatIfResult result = whatIfAnalysisService.analyze(modified, baseline);
        return ApiResponse.success(result);
    }

    /**
     * Run what-if analysis with default baseline.
     */
    @PostMapping("/analyze-default")
    public ApiResponse<WhatIfResult> analyzeWithDefaultBaseline(
            @RequestBody PropertyFeatures modified
    ) {
        log.info("Running what-if analysis with default baseline");

        WhatIfResult result = whatIfAnalysisService.analyzeWithDefaultBaseline(modified);
        return ApiResponse.success(result);
    }

    /**
     * Request body for what-if analysis.
     */
    public record WhatIfRequest(
            double squareFootage,
            int bedrooms,
            double bathrooms,
            int yearBuilt,
            double lotSize,
            double distanceToCityCenter,
            double schoolRating,
            PropertyFeatures baseline
    ) {
    }
}
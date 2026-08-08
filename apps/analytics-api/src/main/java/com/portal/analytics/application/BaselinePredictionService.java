package com.portal.analytics.application;

import com.portal.analytics.domain.ModelInferencePort;
import com.portal.analytics.domain.PredictionResult;
import com.portal.analytics.domain.PropertyFeatures;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Service for caching baseline predictions.
 * 
 * <p>Delegates to {@link BaselinePriceCacheService} to ensure Spring AOP proxy
 * can intercept cache annotations. Internal method calls within the same class
 * bypass the proxy, causing @Cacheable to be ignored.
 * 
 * <p>Caches only the predicted price (double) to avoid complex object serialization issues.
 */
@Service
public class BaselinePredictionService {

    private static final Logger log = LoggerFactory.getLogger(BaselinePredictionService.class);
    private final BaselinePriceCacheService baselinePriceCacheService;

    public BaselinePredictionService(BaselinePriceCacheService baselinePriceCacheService) {
        this.baselinePriceCacheService = baselinePriceCacheService;
    }

    /**
     * Get cached baseline prediction price.
     * Results are cached for 60 seconds to avoid redundant ML calls.
     *
     * @param baseline the baseline features to predict
     * @return prediction result for the baseline
     */
    public PredictionResult getBaselinePrediction(PropertyFeatures baseline) {
        double price = baselinePriceCacheService.getCachedBaselinePrice(baseline);
        return new PredictionResult(price, baseline, Instant.now());
    }

    /**
     * Generate cache key for baseline features.
     */
    public static String toBaselineKey(PropertyFeatures baseline) {
        return String.format("%.1f,%d,%.1f,%d,%.1f,%.1f,%.1f",
                baseline.squareFootage(), baseline.bedrooms(), baseline.bathrooms(),
                baseline.yearBuilt(), baseline.lotSize(), baseline.distanceToCityCenter(), baseline.schoolRating());
    }
}

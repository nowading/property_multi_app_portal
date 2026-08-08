package com.portal.analytics.application;

import com.portal.analytics.adapters.persistence.CacheConfig;
import com.portal.analytics.domain.ModelInferencePort;
import com.portal.analytics.domain.PropertyFeatures;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Service for caching baseline prediction prices.
 * 
 * <p>Separated from {@link BaselinePredictionService} to ensure Spring AOP proxy
 * can intercept cache annotations. This service is injected into BaselinePredictionService
 * to provide proper caching behavior.
 * 
 * <p>Caches only the predicted price (double) to avoid complex object serialization issues.
 */
@Service
public class BaselinePriceCacheService {

    private static final Logger log = LoggerFactory.getLogger(BaselinePriceCacheService.class);
    private final ModelInferencePort modelInferencePort;

    public BaselinePriceCacheService(ModelInferencePort modelInferencePort) {
        this.modelInferencePort = modelInferencePort;
    }

    /**
     * Get cached baseline price.
     * Only caches the price (double) to avoid serialization issues with complex objects.
     *
     * @param baseline the baseline features
     * @return predicted price
     */
    @Cacheable(value = CacheConfig.WHAT_IF_CACHE, key = "'baseline:' + #baseline.squareFootage() + ':' + #baseline.bedrooms() + ':' + #baseline.bathrooms() + ':' + #baseline.yearBuilt() + ':' + #baseline.lotSize() + ':' + #baseline.distanceToCityCenter() + ':' + #baseline.schoolRating()")
    public double getCachedBaselinePrice(PropertyFeatures baseline) {
        log.debug("Cache MISS for baseline price, features={}", baseline);
        return modelInferencePort.predict(baseline).predictedPrice();
    }
}

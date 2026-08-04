package com.portal.analytics.application;

import com.portal.analytics.adapters.persistence.CacheConfig;
import com.portal.analytics.domain.ModelInfo;
import com.portal.analytics.domain.ModelInferencePort;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Service for retrieving model metadata with Redis caching.
 *
 * <p>Caches model info in Redis for 60 seconds since model metadata rarely changes.
 */
@Service
public class ModelInfoService {

    private final ModelInferencePort modelInferencePort;

    private static final String CACHE_KEY = "model-info";

    public ModelInfoService(ModelInferencePort modelInferencePort) {
        this.modelInferencePort = modelInferencePort;
    }

    /**
     * Get model information, cached in Redis for 60 seconds.
     *
     * @return model metadata
     */
    @Cacheable(value = CacheConfig.MODEL_INFO_CACHE, key = "'" + CACHE_KEY + "'")
    public ModelInfo getModelInfo() {
        return modelInferencePort.getModelInfo();
    }

    /**
     * Clear the model info cache (useful for testing or admin operations).
     */
    @CacheEvict(value = CacheConfig.MODEL_INFO_CACHE, allEntries = true)
    public void clearCache() {
        // Cache evicted by annotation
    }
}
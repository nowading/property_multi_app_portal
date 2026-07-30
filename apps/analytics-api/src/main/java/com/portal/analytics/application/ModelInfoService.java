package com.portal.analytics.application;

import com.github.benmanes.caffeine.cache.Cache;
import com.portal.analytics.adapters.persistence.CacheConfig;
import com.portal.analytics.domain.ModelInfo;
import com.portal.analytics.domain.ModelInferencePort;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

/**
 * Service for retrieving model metadata with caching.
 *
 * <p>Caches model info for 60 seconds since model metadata rarely changes.
 */
@Service
public class ModelInfoService {

    private final ModelInferencePort modelInferencePort;
    private final Cache<String, ModelInfo> modelInfoCache;

    private static final String CACHE_KEY = "model-info";

    public ModelInfoService(ModelInferencePort modelInferencePort,
                            @Qualifier(CacheConfig.MODEL_INFO_CACHE) Cache<String, ModelInfo> modelInfoCache) {
        this.modelInferencePort = modelInferencePort;
        this.modelInfoCache = modelInfoCache;
    }

    /**
     * Get model information, cached for 60 seconds.
     *
     * @return model metadata
     */
    public ModelInfo getModelInfo() {
        return modelInfoCache.get(CACHE_KEY, key -> modelInferencePort.getModelInfo());
    }

    /**
     * Clear the model info cache (useful for testing or admin operations).
     */
    public void clearCache() {
        modelInfoCache.invalidateAll();
    }
}
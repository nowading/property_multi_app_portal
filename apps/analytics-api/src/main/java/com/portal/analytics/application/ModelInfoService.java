package com.portal.analytics.application;

import com.portal.analytics.domain.ModelInfo;
import com.portal.analytics.domain.ModelInferencePort;
import org.springframework.stereotype.Service;

/**
 * Service for retrieving ML model metadata.
 *
 * <p>This service delegates to the {@link ModelInferencePort} and
 * exists as a separate use case so it can be cached independently
 * (model info changes rarely).
 */
@Service
public class ModelInfoService {

    private final ModelInferencePort modelInferencePort;

    public ModelInfoService(ModelInferencePort modelInferencePort) {
        this.modelInferencePort = modelInferencePort;
    }

    /**
     * Get ML model metadata.
     *
     * @return model information
     */
    public ModelInfo getInfo() {
        return modelInferencePort.getModelInfo();
    }
}
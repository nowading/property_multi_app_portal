"""BatchPredictUseCase — multi-property price prediction.

Batch predictions are NOT recorded in history (they would flood it). The
caller (web adapter) may persist individual results if needed by routing
them through ``PredictUseCase`` instead.
"""

from __future__ import annotations

from app.domain import ModelInferencePort, PredictionResult, PropertyFeatures


class BatchPredictUseCase:
    """Run a batch prediction preserving input order."""

    def __init__(self, model: ModelInferencePort) -> None:
        self._model = model

    async def execute(
        self, features_list: list[PropertyFeatures]
    ) -> list[PredictionResult]:
        if not features_list:
            return []
        return await self._model.predict_batch(features_list)

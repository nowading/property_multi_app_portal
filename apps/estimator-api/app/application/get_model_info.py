"""GetModelInfoUseCase — fetch ML model metadata."""

from __future__ import annotations

from app.domain import ModelInferencePort, ModelInfo


class GetModelInfoUseCase:
    """Return the trained model's metadata."""

    def __init__(self, model: ModelInferencePort) -> None:
        self._model = model

    async def execute(self) -> ModelInfo:
        return await self._model.get_model_info()

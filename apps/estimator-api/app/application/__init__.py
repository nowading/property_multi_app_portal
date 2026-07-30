"""Application layer (use cases) for the Estimator API.

Use cases coordinate domain entities and ports (ModelInferencePort,
HistoryRepositoryPort, HealthPort) without knowing the concrete adapters.
The web layer injects adapter instances via constructor parameters.
"""

from app.application.check_health import CheckHealthUseCase
from app.application.get_model_info import GetModelInfoUseCase
from app.application.history import (
    ClearHistoryUseCase,
    DeleteHistoryUseCase,
    GetHistoryEntryUseCase,
    ListHistoryUseCase,
)
from app.application.predict import PredictUseCase
from app.application.predict_batch import BatchPredictUseCase

__all__ = [
    "BatchPredictUseCase",
    "CheckHealthUseCase",
    "ClearHistoryUseCase",
    "DeleteHistoryUseCase",
    "GetHistoryEntryUseCase",
    "GetModelInfoUseCase",
    "ListHistoryUseCase",
    "PredictUseCase",
]

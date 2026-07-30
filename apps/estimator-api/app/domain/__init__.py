"""Domain layer (core) of the Estimator API.

Pure business models and ports with zero framework dependencies. Adapters
(application + infrastructure) implement the interfaces declared here.
"""

from app.domain.errors import (
    DomainError,
    ModelInferenceError,
    ModelTimeoutError,
    ModelUnavailableError,
    ValidationError,
)
from app.domain.features import PropertyFeatures
from app.domain.history import HistoryEntry
from app.domain.model_info import ModelInfo
from app.domain.ports import HealthPort, HistoryRepositoryPort, ModelInferencePort
from app.domain.prediction import PredictionResult

__all__ = [
    "DomainError",
    "HistoryEntry",
    "HistoryRepositoryPort",
    "HealthPort",
    "ModelInferenceError",
    "ModelInferencePort",
    "ModelInfo",
    "ModelTimeoutError",
    "ModelUnavailableError",
    "PredictionResult",
    "PropertyFeatures",
    "ValidationError",
]

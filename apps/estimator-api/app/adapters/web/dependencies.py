"""Dependency injection container for the web adapter.

Singletons are initialised once at startup (via ``init_adapters``) and
reused across requests. The ``AdapterContainer`` is exposed so tests can
swap adapters without spinning up a real ML service.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import Depends

from app.adapters.ml_client import HttpxModelInference
from app.adapters.persistence import InMemoryHistoryRepository
from app.application import (
    BatchPredictUseCase,
    CheckHealthUseCase,
    ClearHistoryUseCase,
    DeleteHistoryUseCase,
    GetHistoryEntryUseCase,
    GetModelInfoUseCase,
    ListHistoryUseCase,
    PredictUseCase,
)
from app.core.config import settings
from app.domain import HistoryRepositoryPort, ModelInferencePort

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class AdapterContainer:
    """Holds adapter singletons. Tests may replace fields directly."""

    def __init__(self) -> None:
        self.model_inference: ModelInferencePort | None = None
        self.history_repository: HistoryRepositoryPort | None = None

    def is_initialized(self) -> bool:
        return self.model_inference is not None and self.history_repository is not None


# Module-level singleton — the production wiring. Tests either replace its
# fields directly or use FastAPI's dependency_overrides to substitute fakes.
container = AdapterContainer()


def init_adapters(
    ml_service_url: str | None = None,
    *,
    history_capacity: int = 50,
) -> None:
    """Construct the adapter singletons. Called from the FastAPI lifespan.

    Parameters are optional so tests can call this with a fake URL or rely
    on the configured default.
    """
    url = ml_service_url or settings.ml_service_url
    container.model_inference = HttpxModelInference(
        base_url=url,
        connect_timeout=2.0,
        read_timeout=5.0,
    )
    container.history_repository = InMemoryHistoryRepository(capacity=history_capacity)
    logger.info("adapters_initialized ml_service_url=%s", url)


async def close_adapters() -> None:
    """Release adapter resources. Called from the FastAPI lifespan shutdown."""
    if isinstance(container.model_inference, HttpxModelInference):
        await container.model_inference.aclose()
    container.model_inference = None
    container.history_repository = None
    logger.info("adapters_closed")


# ---------------------------------------------------------------------------
# Port factories — used directly as FastAPI dependencies.
# ---------------------------------------------------------------------------


def get_model_inference() -> ModelInferencePort:
    if container.model_inference is None:
        raise RuntimeError(
            "Model inference adapter not initialised — call init_adapters() first"
        )
    return container.model_inference


def get_history_repository() -> HistoryRepositoryPort:
    if container.history_repository is None:
        raise RuntimeError(
            "History repository adapter not initialised — call init_adapters() first"
        )
    return container.history_repository


# ---------------------------------------------------------------------------
# Use-case factories — composed from port dependencies.
# ---------------------------------------------------------------------------


def get_predict_use_case(
    model: ModelInferencePort = Depends(get_model_inference),
    history: HistoryRepositoryPort = Depends(get_history_repository),
) -> PredictUseCase:
    return PredictUseCase(model=model, history=history)


def get_batch_predict_use_case(
    model: ModelInferencePort = Depends(get_model_inference),
) -> BatchPredictUseCase:
    return BatchPredictUseCase(model=model)


def get_get_model_info_use_case(
    model: ModelInferencePort = Depends(get_model_inference),
) -> GetModelInfoUseCase:
    return GetModelInfoUseCase(model=model)


def get_check_health_use_case(
    model: ModelInferencePort = Depends(get_model_inference),
) -> CheckHealthUseCase:
    # HttpxModelInference implements HealthPort too. If a different port
    # implementation were used, this dependency would resolve HealthPort
    # separately.
    return CheckHealthUseCase(health=model)


def get_list_history_use_case(
    history: HistoryRepositoryPort = Depends(get_history_repository),
) -> ListHistoryUseCase:
    return ListHistoryUseCase(history=history)


def get_get_history_entry_use_case(
    history: HistoryRepositoryPort = Depends(get_history_repository),
) -> GetHistoryEntryUseCase:
    return GetHistoryEntryUseCase(history=history)


def get_delete_history_use_case(
    history: HistoryRepositoryPort = Depends(get_history_repository),
) -> DeleteHistoryUseCase:
    return DeleteHistoryUseCase(history=history)


def get_clear_history_use_case(
    history: HistoryRepositoryPort = Depends(get_history_repository),
) -> ClearHistoryUseCase:
    return ClearHistoryUseCase(history=history)

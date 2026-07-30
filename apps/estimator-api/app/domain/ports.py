"""Ports (interfaces) declared by the domain layer.

Adapters in ``app/adapters/`` implement these abstract classes. Keeping the
interfaces here lets the application layer depend on abstractions, not
concrete infrastructure (httpx, in-memory store, etc.).
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.features import PropertyFeatures
from app.domain.history import HistoryEntry
from app.domain.model_info import ModelInfo
from app.domain.prediction import PredictionResult


class ModelInferencePort(ABC):
    """Port for calling the ML model container."""

    @abstractmethod
    async def predict(self, features: PropertyFeatures) -> PredictionResult:
        """Run a single prediction and return a domain ``PredictionResult``."""

    @abstractmethod
    async def predict_batch(
        self, features_list: list[PropertyFeatures]
    ) -> list[PredictionResult]:
        """Run a batch prediction preserving input order."""

    @abstractmethod
    async def get_model_info(self) -> ModelInfo:
        """Return the ML model's metadata as a domain ``ModelInfo``."""


class HealthPort(ABC):
    """Port for checking downstream service health."""

    @abstractmethod
    async def is_healthy(self) -> bool:
        """Return True if the downstream service responds positively."""


class HistoryRepositoryPort(ABC):
    """Port for persisting prediction history.

    The default adapter is an in-memory thread-safe store, but the abstraction
    allows swapping in a database later without touching the application layer.
    """

    @abstractmethod
    async def add(self, entry: HistoryEntry) -> HistoryEntry:
        """Persist a new entry. May evict the oldest if at capacity."""

    @abstractmethod
    async def list(self) -> list[HistoryEntry]:
        """Return all entries, newest first."""

    @abstractmethod
    async def get(self, entry_id: str) -> HistoryEntry | None:
        """Return a single entry by id, or ``None`` if not found."""

    @abstractmethod
    async def delete(self, entry_id: str) -> bool:
        """Delete the entry with the given id. Return True if something was deleted."""

    @abstractmethod
    async def clear(self) -> int:
        """Remove all entries. Return the number of entries removed."""

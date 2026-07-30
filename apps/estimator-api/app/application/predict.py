"""PredictUseCase — single-property price prediction.

Orchestrates:
1. Call the ML inference port.
2. Persist the result to the history repository (best-effort; failure to
   persist must not mask the prediction).
3. Return the domain ``PredictionResult``.
"""

from __future__ import annotations

import logging

from app.domain import (
    HistoryRepositoryPort,
    ModelInferencePort,
    PredictionResult,
    PropertyFeatures,
)

logger = logging.getLogger(__name__)


class PredictUseCase:
    """Run a single prediction and record it in history."""

    def __init__(
        self,
        model: ModelInferencePort,
        history: HistoryRepositoryPort,
    ) -> None:
        self._model = model
        self._history = history

    async def execute(self, features: PropertyFeatures) -> PredictionResult:
        """Run inference and persist a history entry.

        The ML call is the source of truth — if history persistence fails,
        we log and return the prediction anyway. The user gets their answer.
        """
        result = await self._model.predict(features)

        # Best-effort history persistence. Failures here should not propagate
        # to the caller; the prediction itself succeeded.
        try:
            from app.domain import HistoryEntry

            entry = HistoryEntry.create(
                features=result.features,
                predicted_price=result.predicted_price,
                created_at=result.timestamp,
            )
            await self._history.add(entry)
        except Exception:  # pragma: no cover — defensive, log-only
            logger.exception("Failed to persist prediction to history")

        return result

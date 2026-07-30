"""PredictionResult value object — output of a single model inference."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.features import PropertyFeatures


@dataclass(frozen=True)
class PredictionResult:
    """Immutable prediction result bundling the price and the input features.

    Storing the input features alongside the price lets the application layer
    persist a self-contained history entry without re-querying the caller.
    """

    predicted_price: float
    features: PropertyFeatures
    timestamp: datetime

    @staticmethod
    def now() -> datetime:
        """UTC now — exposed as a helper to keep timestamps consistent."""
        return datetime.now(timezone.utc)

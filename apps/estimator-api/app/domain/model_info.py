"""ModelInfo value object — metadata describing the trained ML model.

Returned by ``GET /model-info`` on the ML container. The domain layer defines
the shape so the application layer is not coupled to the wire JSON format.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ModelInfo:
    """Immutable snapshot of the ML model's metadata.

    The ML container returns ``n_samples_trained`` as either an int or the
    literal string ``"<dynamic>"``; we preserve it as ``Any`` to avoid
    coercing semantics the domain doesn't own.
    """

    model_type: str
    coefficients: dict[str, float]
    intercept: float
    metrics: dict[str, float]
    training_date: str
    n_samples_trained: Any
    excluded_features: list[str] = field(default_factory=list)

    def to_payload(self) -> dict[str, Any]:
        """Serialise to the JSON shape consumed by the web adapter."""
        return {
            "model_type": self.model_type,
            "coefficients": dict(self.coefficients),
            "intercept": self.intercept,
            "metrics": dict(self.metrics),
            "training_date": self.training_date,
            "n_samples_trained": self.n_samples_trained,
            "excluded_features": list(self.excluded_features),
        }

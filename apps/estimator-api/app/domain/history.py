"""HistoryEntry entity — a persisted prediction record.

The Estimator API keeps an in-memory history (no DB per project scope).
HistoryEntry is the domain shape; the persistence adapter owns the storage
mechanism (a thread-safe deque) and exposes operations via
``HistoryRepositoryPort``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from app.domain.features import PropertyFeatures


@dataclass(frozen=True)
class HistoryEntry:
    """Immutable record of one prediction call."""

    id: str
    features: PropertyFeatures
    predicted_price: float
    created_at: datetime

    @classmethod
    def create(
        cls,
        features: PropertyFeatures,
        predicted_price: float,
        created_at: datetime | None = None,
    ) -> "HistoryEntry":
        """Factory that generates a fresh UUID and defaults ``created_at`` to now."""
        from datetime import timezone

        return cls(
            id=str(uuid4()),
            features=features,
            predicted_price=predicted_price,
            created_at=created_at or datetime.now(timezone.utc),
        )

    def to_payload(self) -> dict[str, object]:
        """Serialise for the unified envelope (matches frontend HistoryEntry)."""
        return {
            "id": self.id,
            "features": self.features.to_payload(),
            "predicted_price": self.predicted_price,
            "created_at": self.created_at.isoformat(),
        }

    @property
    def uuid(self) -> UUID:
        """Parse the string id back to UUID (used by repositories for equality)."""
        return UUID(self.id)

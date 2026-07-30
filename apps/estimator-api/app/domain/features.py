"""PropertyFeatures domain entity.

Encapsulates the 7 ML input features and enforces domain invariants.
This module imports only the Python standard library — no FastAPI, no
Pydantic — so the domain remains framework-free per Clean Architecture.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.errors import ValidationError

# Domain-level constraints. The web adapter's Pydantic DTOs duplicate these
# rules for HTTP-facing validation; keeping them here lets the application
# layer construct entities safely without going through HTTP.
MIN_YEAR_BUILT = 1800
MAX_YEAR_BUILT = datetime.now(timezone.utc).year + 1  # allow next year (build year)
MIN_SCHOOL_RATING = 1.0
MAX_SCHOOL_RATING = 10.0


@dataclass(frozen=True)
class PropertyFeatures:
    """Immutable value object representing the 7 ML input features.

    Attributes mirror the ML container's expected JSON keys exactly so the
    adapter layer can serialise without renaming.
    """

    square_footage: float
    bedrooms: int
    bathrooms: float
    year_built: int
    lot_size: float
    distance_to_city_center: float
    school_rating: float

    def __post_init__(self) -> None:
        """Validate invariants; raise ``ValidationError`` on any violation."""
        errors: list[str] = []

        if self.square_footage <= 0:
            errors.append("square_footage must be > 0")
        if self.bedrooms < 0:
            errors.append("bedrooms must be >= 0")
        if self.bathrooms < 0:
            errors.append("bathrooms must be >= 0")
        if self.year_built < MIN_YEAR_BUILT:
            errors.append(f"year_built must be >= {MIN_YEAR_BUILT}")
        if self.year_built > MAX_YEAR_BUILT:
            errors.append(f"year_built must be <= {MAX_YEAR_BUILT}")
        if self.lot_size <= 0:
            errors.append("lot_size must be > 0")
        if self.distance_to_city_center < 0:
            errors.append("distance_to_city_center must be >= 0")
        if self.school_rating < MIN_SCHOOL_RATING:
            errors.append(f"school_rating must be >= {MIN_SCHOOL_RATING}")
        if self.school_rating > MAX_SCHOOL_RATING:
            errors.append(f"school_rating must be <= {MAX_SCHOOL_RATING}")

        if errors:
            raise ValidationError("; ".join(errors))

    def to_payload(self) -> dict[str, float | int]:
        """Return a JSON-serialisable dict matching the ML container schema."""
        return {
            "square_footage": self.square_footage,
            "bedrooms": self.bedrooms,
            "bathrooms": self.bathrooms,
            "year_built": self.year_built,
            "lot_size": self.lot_size,
            "distance_to_city_center": self.distance_to_city_center,
            "school_rating": self.school_rating,
        }

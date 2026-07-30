"""Pydantic v2 DTOs for the web adapter.

Each DTO mirrors the corresponding domain entity's wire shape. Validation
constraints duplicate the domain invariants (DRY is relaxed here on purpose:
the web layer validates at the system boundary, the domain layer enforces
its own rules regardless of caller).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.domain.features import (
    MAX_SCHOOL_RATING,
    MAX_YEAR_BUILT,
    MIN_SCHOOL_RATING,
    MIN_YEAR_BUILT,
)


# ---------------------------------------------------------------------------
# Property features
# ---------------------------------------------------------------------------


class PropertyFeaturesDTO(BaseModel):
    """Wire representation of the 7 ML input features."""

    model_config = ConfigDict(extra="forbid")

    square_footage: float = Field(gt=0, description="Total living area (sq ft)")
    bedrooms: int = Field(ge=0, description="Number of bedrooms")
    bathrooms: float = Field(ge=0, description="Number of bathrooms")
    year_built: int = Field(
        ge=MIN_YEAR_BUILT,
        le=MAX_YEAR_BUILT,
        description="Year the house was built",
    )
    lot_size: float = Field(gt=0, description="Lot size (sq ft)")
    distance_to_city_center: float = Field(
        ge=0, description="Distance to city center (miles)"
    )
    school_rating: float = Field(
        ge=MIN_SCHOOL_RATING,
        le=MAX_SCHOOL_RATING,
        description="Local school rating (1-10)",
    )

    def to_domain(self):
        """Convert to the domain ``PropertyFeatures`` entity."""
        from app.domain import PropertyFeatures

        return PropertyFeatures(
            square_footage=self.square_footage,
            bedrooms=self.bedrooms,
            bathrooms=self.bathrooms,
            year_built=self.year_built,
            lot_size=self.lot_size,
            distance_to_city_center=self.distance_to_city_center,
            school_rating=self.school_rating,
        )


# ---------------------------------------------------------------------------
# Predict
# ---------------------------------------------------------------------------


class PredictRequest(BaseModel):
    """Body for ``POST /predict`` — matches the ML container's shape."""

    model_config = ConfigDict(extra="forbid")

    features: PropertyFeaturesDTO


class PredictionResultDTO(BaseModel):
    """Wire representation of a single prediction."""

    predicted_price: float
    features: PropertyFeaturesDTO
    timestamp: datetime


class BatchPredictRequest(BaseModel):
    """Body for ``POST /predict/batch``."""

    model_config = ConfigDict(extra="forbid")

    features: list[PropertyFeaturesDTO] = Field(min_length=1, max_length=100)


class BatchPredictionResultDTO(BaseModel):
    """Wire representation of a batch prediction response."""

    predictions: list[PredictionResultDTO]
    total: int


# ---------------------------------------------------------------------------
# Model info
# ---------------------------------------------------------------------------


class ModelInfoDTO(BaseModel):
    """Wire representation of ML model metadata."""

    model_type: str
    coefficients: dict[str, float]
    intercept: float
    metrics: dict[str, float]
    training_date: str
    n_samples_trained: Any  # int or "<dynamic>"
    excluded_features: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------


class HistoryEntryDTO(BaseModel):
    """Wire representation of a stored history entry."""

    id: str
    features: PropertyFeaturesDTO
    predicted_price: float
    created_at: datetime


class HistoryListDTO(BaseModel):
    """Wire representation of the history list response payload."""

    entries: list[HistoryEntryDTO]
    count: int


class HistoryDeleteResultDTO(BaseModel):
    deleted: bool


class HistoryClearResultDTO(BaseModel):
    cleared: int


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthDTO(BaseModel):
    """Wire representation of the health-check payload."""

    status: str
    service: str
    ml_healthy: bool
    timestamp: datetime

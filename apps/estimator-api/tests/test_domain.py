"""Unit tests for the domain layer (Phase 3.1).

The domain layer must be framework-free and enforce its own invariants.
These tests verify entity construction, validation, serialisation, and
port contracts without importing FastAPI or Pydantic.
"""

from __future__ import annotations

import inspect
from dataclasses import FrozenInstanceError
from datetime import datetime, timezone
from uuid import UUID

import pytest

from app.domain import (
    DomainError,
    HistoryEntry,
    HistoryRepositoryPort,
    HealthPort,
    ModelInferenceError,
    ModelInferencePort,
    ModelInfo,
    ModelTimeoutError,
    ModelUnavailableError,
    PredictionResult,
    PropertyFeatures,
    ValidationError,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def valid_kwargs(**overrides: object) -> dict:
    base: dict[str, object] = {
        "square_footage": 2000.0,
        "bedrooms": 3,
        "bathrooms": 2.5,
        "year_built": 1990,
        "lot_size": 5000.0,
        "distance_to_city_center": 5.5,
        "school_rating": 8.0,
    }
    base.update(overrides)
    return base


def make_features(**overrides: object) -> PropertyFeatures:
    return PropertyFeatures(**valid_kwargs(**overrides))


# ---------------------------------------------------------------------------
# PropertyFeatures
# ---------------------------------------------------------------------------


class TestPropertyFeatures:
    def test_constructs_with_valid_values(self) -> None:
        f = make_features()
        assert f.square_footage == 2000.0
        assert f.bedrooms == 3
        assert f.bathrooms == 2.5
        assert f.year_built == 1990
        assert f.lot_size == 5000.0
        assert f.distance_to_city_center == 5.5
        assert f.school_rating == 8.0

    def test_is_frozen(self) -> None:
        f = make_features()
        with pytest.raises(FrozenInstanceError):
            f.square_footage = 9999  # type: ignore[misc]

    @pytest.mark.parametrize(
        "field, bad_value",
        [
            ("square_footage", 0),
            ("square_footage", -1),
            ("bedrooms", -1),
            ("bathrooms", -0.5),
            ("year_built", 1799),
            ("lot_size", 0),
            ("lot_size", -1),
            ("distance_to_city_center", -0.1),
            ("school_rating", 0.5),
            ("school_rating", 10.5),
        ],
    )
    def test_invalid_values_raise_validation_error(
        self, field: str, bad_value: object
    ) -> None:
        with pytest.raises(ValidationError) as exc_info:
            make_features(**{field: bad_value})
        # The offending field name should appear in the message
        assert field in str(exc_info.value)

    def test_boundary_values_are_accepted(self) -> None:
        """Edge values that satisfy ``>=`` / ``<=`` must be valid."""
        make_features(
            square_footage=1,
            bedrooms=0,
            bathrooms=0,
            lot_size=1,
            distance_to_city_center=0,
            school_rating=1.0,
        )
        # school_rating upper bound
        make_features(school_rating=10.0)

    def test_year_built_allows_next_year(self) -> None:
        next_year = datetime.now(timezone.utc).year + 1
        make_features(year_built=next_year)

    def test_year_built_rejects_far_future(self) -> None:
        far_future = datetime.now(timezone.utc).year + 5
        with pytest.raises(ValidationError):
            make_features(year_built=far_future)

    def test_validation_error_aggregates_multiple_issues(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            PropertyFeatures(
                square_footage=-1,
                bedrooms=-2,
                bathrooms=-3,
                year_built=1000,
                lot_size=0,
                distance_to_city_center=-1,
                school_rating=99,
            )
        msg = str(exc_info.value)
        assert "square_footage" in msg
        assert "bedrooms" in msg
        assert "school_rating" in msg

    def test_to_payload_returns_ml_container_keys(self) -> None:
        f = make_features()
        payload = f.to_payload()
        assert set(payload.keys()) == {
            "square_footage",
            "bedrooms",
            "bathrooms",
            "year_built",
            "lot_size",
            "distance_to_city_center",
            "school_rating",
        }
        assert payload["square_footage"] == 2000.0
        assert payload["bedrooms"] == 3


# ---------------------------------------------------------------------------
# PredictionResult
# ---------------------------------------------------------------------------


class TestPredictionResult:
    def test_constructs_and_preserves_features(self) -> None:
        f = make_features()
        ts = datetime.now(timezone.utc)
        r = PredictionResult(
            predicted_price=350_000.50,
            features=f,
            timestamp=ts,
        )
        assert r.predicted_price == 350_000.50
        assert r.features is f
        assert r.timestamp is ts

    def test_is_frozen(self) -> None:
        r = PredictionResult(
            predicted_price=1.0,
            features=make_features(),
            timestamp=datetime.now(timezone.utc),
        )
        with pytest.raises(FrozenInstanceError):
            r.predicted_price = 2.0  # type: ignore[misc]

    def test_now_helper_returns_utc(self) -> None:
        ts = PredictionResult.now()
        assert ts.tzinfo is timezone.utc


# ---------------------------------------------------------------------------
# ModelInfo
# ---------------------------------------------------------------------------


class TestModelInfo:
    def _make(self) -> ModelInfo:
        return ModelInfo(
            model_type="LinearRegression",
            coefficients={"square_footage": 112.45},
            intercept=-186320.45,
            metrics={"r_squared": 0.87, "rmse": 25430.15, "mae": 18200.42},
            training_date="2026-07-29T10:00:00Z",
            n_samples_trained="<dynamic>",
            excluded_features=["id", "price"],
        )

    def test_to_payload_round_trip(self) -> None:
        info = self._make()
        payload = info.to_payload()
        assert payload["model_type"] == "LinearRegression"
        assert payload["coefficients"] == {"square_footage": 112.45}
        assert payload["intercept"] == -186320.45
        assert payload["metrics"]["r_squared"] == 0.87
        assert payload["n_samples_trained"] == "<dynamic>"
        assert payload["excluded_features"] == ["id", "price"]

    def test_to_payload_does_not_mutate_internal_state(self) -> None:
        info = self._make()
        payload = info.to_payload()
        payload["coefficients"]["new"] = 999.0
        payload["excluded_features"].append("foo")
        # Original ModelInfo must be untouched
        assert "new" not in info.coefficients
        assert "foo" not in info.excluded_features

    def test_default_excluded_features_is_empty_list(self) -> None:
        info = ModelInfo(
            model_type="X",
            coefficients={},
            intercept=0.0,
            metrics={},
            training_date="",
            n_samples_trained=0,
        )
        assert info.excluded_features == []


# ---------------------------------------------------------------------------
# HistoryEntry
# ---------------------------------------------------------------------------


class TestHistoryEntry:
    def test_create_generates_uuid_and_timestamp(self) -> None:
        f = make_features()
        entry = HistoryEntry.create(features=f, predicted_price=250_000.0)
        # id parses as UUID
        UUID(entry.id)
        assert entry.features is f
        assert entry.predicted_price == 250_000.0
        assert entry.created_at.tzinfo is timezone.utc

    def test_create_accepts_explicit_timestamp(self) -> None:
        ts = datetime(2025, 1, 1, tzinfo=timezone.utc)
        entry = HistoryEntry.create(
            features=make_features(),
            predicted_price=1.0,
            created_at=ts,
        )
        assert entry.created_at == ts

    def test_to_payload_is_json_safe(self) -> None:
        entry = HistoryEntry.create(
            features=make_features(square_footage=1500.0),
            predicted_price=199_999.99,
        )
        payload = entry.to_payload()
        assert payload["id"] == entry.id
        assert payload["predicted_price"] == 199_999.99
        assert payload["features"]["square_footage"] == 1500.0
        # created_at must be an ISO string, not a datetime object
        assert isinstance(payload["created_at"], str)
        datetime.fromisoformat(payload["created_at"])

    def test_two_entries_have_distinct_ids(self) -> None:
        f = make_features()
        a = HistoryEntry.create(features=f, predicted_price=1.0)
        b = HistoryEntry.create(features=f, predicted_price=1.0)
        assert a.id != b.id


# ---------------------------------------------------------------------------
# Error hierarchy
# ---------------------------------------------------------------------------


class TestDomainErrors:
    def test_all_inherit_from_domain_error(self) -> None:
        for cls in (
            ValidationError,
            ModelInferenceError,
            ModelTimeoutError,
            ModelUnavailableError,
        ):
            assert issubclass(cls, DomainError)
            assert issubclass(cls, Exception)

    def test_each_has_distinct_code(self) -> None:
        codes = {
            ValidationError().code if False else ValidationError.code,
            ModelInferenceError.code,
            ModelTimeoutError.code,
            ModelUnavailableError.code,
        }
        assert codes == {
            "VALIDATION_ERROR",
            "ML_INFERENCE_ERROR",
            "ML_SERVICE_TIMEOUT",
            "ML_SERVICE_UNAVAILABLE",
        }

    def test_domain_error_carries_message_and_code(self) -> None:
        err = ValidationError("bad input")
        assert err.message == "bad input"
        assert err.code == "VALIDATION_ERROR"
        assert str(err) == "bad input"

    def test_code_can_be_overridden_at_construction(self) -> None:
        err = DomainError("x", code="CUSTOM")
        assert err.code == "CUSTOM"


# ---------------------------------------------------------------------------
# Ports — abstract contract
# ---------------------------------------------------------------------------


class TestPorts:
    def test_model_inference_port_is_abstract(self) -> None:
        assert inspect.isabstract(ModelInferencePort)
        with pytest.raises(TypeError):
            ModelInferencePort()  # type: ignore[abstract]

    def test_history_repository_port_is_abstract(self) -> None:
        assert inspect.isabstract(HistoryRepositoryPort)
        with pytest.raises(TypeError):
            HistoryRepositoryPort()  # type: ignore[abstract]

    def test_health_port_is_abstract(self) -> None:
        assert inspect.isabstract(HealthPort)
        with pytest.raises(TypeError):
            HealthPort()  # type: ignore[abstract]

    def test_model_inference_port_declares_three_methods(self) -> None:
        abstract_methods = ModelInferencePort.__abstractmethods__
        assert {"predict", "predict_batch", "get_model_info"} <= abstract_methods

    def test_history_repository_port_declares_five_methods(self) -> None:
        abstract_methods = HistoryRepositoryPort.__abstractmethods__
        assert {"add", "list", "get", "delete", "clear"} <= abstract_methods

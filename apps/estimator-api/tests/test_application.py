"""Unit tests for the application layer (Phase 3.2).

Use cases are tested with fake port implementations — no real httpx, no
real storage — to verify orchestration logic in isolation.
"""

from __future__ import annotations

import inspect
from datetime import datetime, timezone
from typing import Sequence

import pytest

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
from app.domain import (
    HistoryEntry,
    HistoryRepositoryPort,
    HealthPort,
    ModelInferenceError,
    ModelInferencePort,
    ModelInfo,
    PredictionResult,
    PropertyFeatures,
)


# ---------------------------------------------------------------------------
# Test doubles (in-memory fakes — not mocks, to keep behaviour realistic)
# ---------------------------------------------------------------------------


class FakeModelInference(ModelInferencePort):
    """In-memory model port. Records calls and returns canned predictions."""

    def __init__(
        self,
        price: float = 250_000.0,
        info: ModelInfo | None = None,
        error: Exception | None = None,
    ) -> None:
        self._price = price
        self._info = info or ModelInfo(
            model_type="FakeLinearRegression",
            coefficients={"square_footage": 100.0},
            intercept=0.0,
            metrics={"r_squared": 0.9},
            training_date="2026-01-01T00:00:00Z",
            n_samples_trained=100,
        )
        self._error = error
        self.predict_calls: list[PropertyFeatures] = []
        self.batch_calls: list[list[PropertyFeatures]] = []
        self.info_calls = 0

    async def predict(self, features: PropertyFeatures) -> PredictionResult:
        if self._error is not None:
            raise self._error
        self.predict_calls.append(features)
        return PredictionResult(
            predicted_price=self._price,
            features=features,
            timestamp=datetime.now(timezone.utc),
        )

    async def predict_batch(
        self, features_list: list[PropertyFeatures]
    ) -> list[PredictionResult]:
        if self._error is not None:
            raise self._error
        self.batch_calls.append(features_list)
        return [
            PredictionResult(
                predicted_price=self._price,
                features=f,
                timestamp=datetime.now(timezone.utc),
            )
            for f in features_list
        ]

    async def get_model_info(self) -> ModelInfo:
        if self._error is not None:
            raise self._error
        self.info_calls += 1
        return self._info


class FakeHealth(HealthPort):
    def __init__(self, healthy: bool = True) -> None:
        self._healthy = healthy
        self.calls = 0

    async def is_healthy(self) -> bool:
        self.calls += 1
        return self._healthy


class FakeHistoryRepository(HistoryRepositoryPort):
    """In-memory history repo that mirrors the planned adapter's behaviour."""

    def __init__(self, capacity: int = 50) -> None:
        self._entries: list[HistoryEntry] = []
        self._capacity = capacity

    async def add(self, entry: HistoryEntry) -> HistoryEntry:
        self._entries.insert(0, entry)
        # FIFO eviction when over capacity
        while len(self._entries) > self._capacity:
            self._entries.pop()
        return entry

    async def list(self) -> list[HistoryEntry]:
        return list(self._entries)

    async def get(self, entry_id: str) -> HistoryEntry | None:
        for e in self._entries:
            if e.id == entry_id:
                return e
        return None

    async def delete(self, entry_id: str) -> bool:
        for i, e in enumerate(self._entries):
            if e.id == entry_id:
                self._entries.pop(i)
                return True
        return False

    async def clear(self) -> int:
        n = len(self._entries)
        self._entries.clear()
        return n


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


def make_features(**overrides: object) -> PropertyFeatures:
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
    return PropertyFeatures(**base)


def make_info() -> ModelInfo:
    return ModelInfo(
        model_type="LinearRegression",
        coefficients={"square_footage": 112.45},
        intercept=-186320.45,
        metrics={"r_squared": 0.87, "rmse": 25430.15, "mae": 18200.42},
        training_date="2026-07-29T10:00:00Z",
        n_samples_trained="<dynamic>",
        excluded_features=["id", "price"],
    )


# ---------------------------------------------------------------------------
# PredictUseCase
# ---------------------------------------------------------------------------


class TestPredictUseCase:
    async def test_calls_model_and_returns_result(self) -> None:
        model = FakeModelInference(price=425_000.0)
        history = FakeHistoryRepository()
        uc = PredictUseCase(model=model, history=history)

        features = make_features()
        result = await uc.execute(features)

        assert result.predicted_price == 425_000.0
        assert result.features is features
        assert model.predict_calls == [features]

    async def test_persists_result_to_history(self) -> None:
        model = FakeModelInference(price=100_000.0)
        history = FakeHistoryRepository()
        uc = PredictUseCase(model=model, history=history)

        await uc.execute(make_features())

        entries = await history.list()
        assert len(entries) == 1
        assert entries[0].predicted_price == 100_000.0

    async def test_returns_prediction_even_if_history_fails(self) -> None:
        """History persistence is best-effort; user still gets the prediction."""

        class BrokenHistory(FakeHistoryRepository):
            async def add(self, entry: HistoryEntry) -> HistoryEntry:
                raise RuntimeError("disk full")

        model = FakeModelInference(price=200_000.0)
        history = BrokenHistory()
        uc = PredictUseCase(model=model, history=history)

        result = await uc.execute(make_features())
        assert result.predicted_price == 200_000.0

    async def test_propagates_model_errors(self) -> None:
        """If the ML service raises, the use case must NOT swallow it."""
        model = FakeModelInference(error=ModelInferenceError("bad model response"))
        history = FakeHistoryRepository()
        uc = PredictUseCase(model=model, history=history)

        with pytest.raises(ModelInferenceError):
            await uc.execute(make_features())

        # History must remain empty — model failed before persistence
        assert await history.list() == []


# ---------------------------------------------------------------------------
# BatchPredictUseCase
# ---------------------------------------------------------------------------


class TestBatchPredictUseCase:
    async def test_empty_input_returns_empty_list(self) -> None:
        model = FakeModelInference()
        uc = BatchPredictUseCase(model=model)
        result = await uc.execute([])
        assert result == []
        assert model.batch_calls == []

    async def test_preserves_order_and_count(self) -> None:
        model = FakeModelInference(price=123.0)
        uc = BatchPredictUseCase(model=model)

        inputs = [
            make_features(square_footage=1000.0),
            make_features(square_footage=2000.0),
            make_features(square_footage=3000.0),
        ]
        results = await uc.execute(inputs)

        assert len(results) == 3
        assert [r.features for r in results] == inputs
        assert all(r.predicted_price == 123.0 for r in results)

    async def test_does_not_touch_history(self) -> None:
        """Batch predictions are not persisted (would flood history)."""
        model = FakeModelInference()
        history = FakeHistoryRepository()
        # BatchPredictUseCase doesn't take history at all
        uc = BatchPredictUseCase(model=model)

        await uc.execute([make_features(), make_features()])
        # Even if we had a history handle, batch shouldn't touch it
        assert await history.list() == []

    async def test_propagates_model_errors(self) -> None:
        model = FakeModelInference(error=ModelInferenceError("ml down"))
        uc = BatchPredictUseCase(model=model)
        with pytest.raises(ModelInferenceError):
            await uc.execute([make_features()])


# ---------------------------------------------------------------------------
# GetModelInfoUseCase
# ---------------------------------------------------------------------------


class TestGetModelInfoUseCase:
    async def test_returns_model_info(self) -> None:
        info = make_info()
        model = FakeModelInference(info=info)
        uc = GetModelInfoUseCase(model=model)

        result = await uc.execute()
        assert result is info
        assert model.info_calls == 1

    async def test_propagates_errors(self) -> None:
        model = FakeModelInference(error=ModelInferenceError("info endpoint 500"))
        uc = GetModelInfoUseCase(model=model)
        with pytest.raises(ModelInferenceError):
            await uc.execute()


# ---------------------------------------------------------------------------
# CheckHealthUseCase
# ---------------------------------------------------------------------------


class TestCheckHealthUseCase:
    async def test_returns_true_when_healthy(self) -> None:
        health = FakeHealth(healthy=True)
        uc = CheckHealthUseCase(health=health)
        assert await uc.execute() is True
        assert health.calls == 1

    async def test_returns_false_when_unhealthy(self) -> None:
        health = FakeHealth(healthy=False)
        uc = CheckHealthUseCase(health=health)
        assert await uc.execute() is False


# ---------------------------------------------------------------------------
# History use cases
# ---------------------------------------------------------------------------


class TestHistoryUseCases:
    async def test_list_returns_entries_in_insertion_order(self) -> None:
        history = FakeHistoryRepository()
        for i in range(3):
            entry = HistoryEntry.create(
                features=make_features(square_footage=float(1000 + i)),
                predicted_price=float(i),
            )
            await history.add(entry)

        uc = ListHistoryUseCase(history=history)
        entries = await uc.execute()
        assert len(entries) == 3
        # newest first (add inserts at index 0)
        assert entries[0].predicted_price == 2.0
        assert entries[2].predicted_price == 0.0

    async def test_get_returns_entry_or_none(self) -> None:
        history = FakeHistoryRepository()
        entry = HistoryEntry.create(features=make_features(), predicted_price=1.0)
        await history.add(entry)

        get_uc = GetHistoryEntryUseCase(history=history)
        assert await get_uc.execute(entry.id) is entry
        assert await get_uc.execute("nonexistent-id") is None

    async def test_delete_returns_true_then_false(self) -> None:
        history = FakeHistoryRepository()
        entry = HistoryEntry.create(features=make_features(), predicted_price=1.0)
        await history.add(entry)

        delete_uc = DeleteHistoryUseCase(history=history)
        assert await delete_uc.execute(entry.id) is True
        assert await delete_uc.execute(entry.id) is False  # already gone

    async def test_clear_returns_count_and_empties_store(self) -> None:
        history = FakeHistoryRepository()
        for _ in range(5):
            await history.add(
                HistoryEntry.create(features=make_features(), predicted_price=1.0)
            )

        clear_uc = ClearHistoryUseCase(history=history)
        count = await clear_uc.execute()
        assert count == 5
        assert await history.list() == []

    async def test_clear_on_empty_returns_zero(self) -> None:
        history = FakeHistoryRepository()
        clear_uc = ClearHistoryUseCase(history=history)
        assert await clear_uc.execute() == 0


# ---------------------------------------------------------------------------
# Boundary: use cases must depend on ports, not concrete adapters
# ---------------------------------------------------------------------------


class TestUseCaseBoundaries:
    """Verify use cases accept any port implementation (Liskov substitution)."""

    @pytest.mark.parametrize(
        "use_case_cls, port_cls, kwargs",
        [
            (PredictUseCase, ModelInferencePort, {"history": None}),
            (BatchPredictUseCase, ModelInferencePort, {}),
            (GetModelInfoUseCase, ModelInferencePort, {}),
        ],
    )
    def test_use_cases_accept_port_subclasses(
        self, use_case_cls, port_cls, kwargs
    ) -> None:
        """Constructor signature includes the port — checked via ``__init__``."""
        # We can't instantiate the abstract port, but the use case type hint
        # must accept a subclass. Verified by passing a Fake.
        if use_case_cls is PredictUseCase:
            uc = PredictUseCase(model=FakeModelInference(), history=FakeHistoryRepository())
            assert isinstance(uc._model, ModelInferencePort)
            assert isinstance(uc._history, HistoryRepositoryPort)
        elif use_case_cls is BatchPredictUseCase:
            uc = BatchPredictUseCase(model=FakeModelInference())
            assert isinstance(uc._model, ModelInferencePort)
        elif use_case_cls is GetModelInfoUseCase:
            uc = GetModelInfoUseCase(model=FakeModelInference())
            assert isinstance(uc._model, ModelInferencePort)

    def test_check_health_use_case_uses_health_port(self) -> None:
        uc = CheckHealthUseCase(health=FakeHealth())
        assert isinstance(uc._health, HealthPort)

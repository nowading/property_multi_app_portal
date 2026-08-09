"""Shared pytest fixtures for the Estimator API test suite.

Provides:
- ``FakeModelInference`` — in-memory model port for deterministic tests.
- ``FakeHistoryRepository`` — in-memory history port.
- ``app`` — FastAPI instance wired with fakes via dependency overrides.
- ``client`` — ``httpx.Client`` driven by ASGI transport (no real network).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.web.dependencies import (
    get_batch_predict_use_case,
    get_check_health_use_case,
    get_clear_history_use_case,
    get_delete_history_use_case,
    get_get_history_entry_use_case,
    get_get_model_info_use_case,
    get_list_history_use_case,
    get_predict_use_case,
)


class _AuthHeaderTestClient(TestClient):
    """TestClient that auto-injects ``x-internal-token`` on every request.

    The stock ``fastapi.testclient.TestClient(app, headers={...})`` does
    pass default headers via httpx, but the bundled ``httpx`` version
    shipped inside the project's image (httpx 0.x) sometimes drops them
    for ``POST``/``PUT`` with a JSON body, causing the inbound
    ``InternalAuthMiddleware`` to see a missing header and return 401.
    This wrapper injects the token at the TestClient level so every
    outgoing request carries it regardless of httpx version quirks.
    """

    def __init__(self, *args, token: str | None = None, **kwargs):
        # Pop the headers kwarg if present so we never rely on the
        # upstream default-header behaviour.
        kwargs.pop("headers", None)
        super().__init__(*args, **kwargs)
        self._auth_token = token

    def _inject(self, headers):
        if not self._auth_token:
            return headers
        merged = dict(headers or {})
        merged.setdefault("x-internal-token", self._auth_token)
        return merged

    def request(self, method, url, **kwargs):  # type: ignore[override]
        kwargs["headers"] = self._inject(kwargs.get("headers"))
        return super().request(method, url, **kwargs)

    def get(self, url, **kwargs):  # type: ignore[override]
        kwargs["headers"] = self._inject(kwargs.get("headers"))
        return super().get(url, **kwargs)

    def post(self, url, **kwargs):  # type: ignore[override]
        kwargs["headers"] = self._inject(kwargs.get("headers"))
        return super().post(url, **kwargs)

    def put(self, url, **kwargs):  # type: ignore[override]
        kwargs["headers"] = self._inject(kwargs.get("headers"))
        return super().put(url, **kwargs)

    def patch(self, url, **kwargs):  # type: ignore[override]
        kwargs["headers"] = self._inject(kwargs.get("headers"))
        return super().patch(url, **kwargs)

    def delete(self, url, **kwargs):  # type: ignore[override]
        kwargs["headers"] = self._inject(kwargs.get("headers"))
        return super().delete(url, **kwargs)


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
from app.domain import (
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
)
from app.main import create_app


# Standard test token used by all suites. Shared between the autouse
# env-mutating fixture and the request-header fixtures so that a value
# written to ``os.environ`` and a value sent in a request always agree.
TEST_INTERNAL_TOKEN = "test-internal-token-please-do-not-use-in-prod"


# ---------------------------------------------------------------------------
# Fakes (shared with test_application.py — duplicated to keep test modules
# independent; a future refactor could move them to a tests/helpers package).
# ---------------------------------------------------------------------------


class FakeModelInference(ModelInferencePort, HealthPort):
    """In-memory model port. Records calls and returns canned predictions."""

    def __init__(
        self,
        price: float = 250_000.0,
        info: ModelInfo | None = None,
        error: Exception | None = None,
        healthy: bool = True,
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
        self._healthy = healthy
        self.predict_calls: list[PropertyFeatures] = []
        self.batch_calls: list[list[PropertyFeatures]] = []
        self.info_calls = 0
        self.health_calls = 0

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

    async def is_healthy(self) -> bool:
        self.health_calls += 1
        if self._error is not None:
            return False
        return self._healthy


class FakeHistoryRepository(HistoryRepositoryPort):
    def __init__(self, capacity: int = 50) -> None:
        self._entries: list[HistoryEntry] = []
        self._capacity = capacity

    async def add(self, entry: HistoryEntry) -> HistoryEntry:
        self._entries.insert(0, entry)
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
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _set_internal_service_token(monkeypatch: pytest.MonkeyPatch) -> None:
    """Configure the internal service token for every test.

    Sets both ``os.environ["INTERNAL_SERVICE_TOKEN"]`` (so the production
    code path that reads env at startup behaves as expected) and
    ``settings.internal_service_token`` (so the already-instantiated
    ``Settings`` instance reflects the test value without needing to be
    rebuilt). Restored automatically by ``monkeypatch`` after the test.
    """
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", TEST_INTERNAL_TOKEN)
    monkeypatch.setattr(settings, "internal_service_token", TEST_INTERNAL_TOKEN)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Headers a request needs to pass the inbound ``x-internal-token`` check."""
    return {"x-internal-token": TEST_INTERNAL_TOKEN}


@pytest.fixture
def fake_model() -> FakeModelInference:
    return FakeModelInference()


@pytest.fixture
def fake_history() -> FakeHistoryRepository:
    return FakeHistoryRepository()


@pytest.fixture
def app(fake_model: FakeModelInference, fake_history: FakeHistoryRepository) -> FastAPI:
    """FastAPI app wired with fakes via dependency_overrides.

    No real ML container is contacted. ``init_adapters`` is bypassed by
    overriding the port factories directly.
    """
    app = create_app()
    app.dependency_overrides[get_predict_use_case] = lambda: PredictUseCase(
        model=fake_model, history=fake_history
    )
    app.dependency_overrides[get_batch_predict_use_case] = lambda: BatchPredictUseCase(
        model=fake_model
    )
    app.dependency_overrides[get_get_model_info_use_case] = (
        lambda: GetModelInfoUseCase(model=fake_model)
    )
    app.dependency_overrides[get_check_health_use_case] = (
        lambda: CheckHealthUseCase(health=fake_model)
    )
    app.dependency_overrides[get_list_history_use_case] = (
        lambda: ListHistoryUseCase(history=fake_history)
    )
    app.dependency_overrides[get_get_history_entry_use_case] = (
        lambda: GetHistoryEntryUseCase(history=fake_history)
    )
    app.dependency_overrides[get_delete_history_use_case] = (
        lambda: DeleteHistoryUseCase(history=fake_history)
    )
    app.dependency_overrides[get_clear_history_use_case] = (
        lambda: ClearHistoryUseCase(history=fake_history)
    )
    return app


@pytest.fixture
def client(app: FastAPI) -> _AuthHeaderTestClient:
    """HTTP client backed by the ASGI transport — no network, no port binding.

    Uses ``fastapi.testclient.TestClient`` (via ``_AuthHeaderTestClient``
    which guarantees the ``x-internal-token`` header is sent on every
    request). The lifespan runs ``init_adapters`` (creating a real
    ``HttpxModelInference`` pointed at ``ML_SERVICE_URL``) but no requests
    reach it because every use case is overridden to use the fakes.

    The default header includes the test internal-service token so the
    ``InternalAuthMiddleware`` lets requests through. Tests that exercise
    the auth middleware itself use ``unauthenticated_client`` instead.
    """
    return _AuthHeaderTestClient(app, token=TEST_INTERNAL_TOKEN)


@pytest.fixture
def unauthenticated_client(app: FastAPI) -> _AuthHeaderTestClient:
    """HTTP client with NO auth headers — used to exercise the auth middleware.

    Routes exempt from auth (``/healthz``) still respond normally; all
    other paths return 401.
    """
    return _AuthHeaderTestClient(app)


# ---------------------------------------------------------------------------
# Shared payload helpers
# ---------------------------------------------------------------------------


def valid_features_payload(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
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


def model_info_payload() -> dict[str, Any]:
    return {
        "model_type": "FakeLinearRegression",
        "coefficients": {"square_footage": 100.0},
        "intercept": 0.0,
        "metrics": {"r_squared": 0.9},
        "training_date": "2026-01-01T00:00:00Z",
        "n_samples_trained": 100,
        "excluded_features": [],
    }

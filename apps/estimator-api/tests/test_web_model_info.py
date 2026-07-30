"""Integration tests for ``GET /model-info``."""

from __future__ import annotations

import httpx


def test_returns_model_info_envelope(client: httpx.Client) -> None:
    response = client.get("/model-info")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert body["error"] is None

    data = body["data"]
    assert data["model_type"] == "FakeLinearRegression"
    assert data["coefficients"] == {"square_footage": 100.0}
    assert data["intercept"] == 0.0
    assert data["metrics"] == {"r_squared": 0.9}
    assert data["training_date"] == "2026-01-01T00:00:00Z"
    assert data["n_samples_trained"] == 100
    assert data["excluded_features"] == []


def test_sets_cacheable_cache_control(client: httpx.Client) -> None:
    """Per PROJECT_PLAN §3.1, /model-info is cacheable for 60s with SWR 300s."""
    response = client.get("/model-info")
    cc = response.headers["cache-control"]
    assert "public" in cc
    assert "max-age=60" in cc
    assert "stale-while-revalidate=300" in cc


def test_ml_unavailable_returns_503(fake_model, client: httpx.Client) -> None:
    from app.domain import ModelUnavailableError

    fake_model._error = ModelUnavailableError("ML down")
    response = client.get("/model-info")
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "ML_SERVICE_UNAVAILABLE"

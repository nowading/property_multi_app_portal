"""Integration tests for ``GET /healthz``."""

from __future__ import annotations

import httpx


def test_healthz_when_ml_healthy(client: httpx.Client) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert body["error"] is None

    data = body["data"]
    assert data["status"] == "healthy"
    assert data["service"] == "estimator-api"
    assert data["ml_healthy"] is True
    assert "timestamp" in data


def test_healthz_when_ml_unhealthy(fake_model, client: httpx.Client) -> None:
    fake_model._healthy = False

    response = client.get("/healthz")
    assert response.status_code == 200  # healthz always 200; status field reflects state

    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "degraded"
    assert body["data"]["ml_healthy"] is False


def test_healthz_has_no_cache_control_header(client: httpx.Client) -> None:
    """Health endpoints must NOT set Cache-Control — probes need fresh data."""
    response = client.get("/healthz")
    assert "cache-control" not in {k.lower() for k in response.headers.keys()}

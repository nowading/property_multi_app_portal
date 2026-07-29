"""Tests for the /healthz endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz_returns_success_envelope() -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    body = response.json()

    # Envelope shape
    assert body["success"] is True
    assert body["error"] is None

    # Payload
    data = body["data"]
    assert data["status"] == "healthy"
    assert data["service"] == "estimator-api"
    assert "timestamp" in data


def test_healthz_has_json_content_type() -> None:
    response = client.get("/healthz")
    assert response.headers["content-type"].startswith("application/json")

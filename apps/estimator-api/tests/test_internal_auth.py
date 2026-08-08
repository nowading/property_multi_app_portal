"""Integration tests for the inbound ``x-internal-token`` middleware (Phase B.3).

Covers the four critical cases:
- ``GET /healthz`` without token → 200 (health is exempt)
- ``POST /predict`` without token → 401
- ``POST /predict`` with wrong token → 401
- ``POST /predict`` with correct token → 200

Also exercises the constant-time compare path and the health-exemption
list to lock in their behaviour.
"""

from __future__ import annotations

import httpx
import pytest

from tests.conftest import TEST_INTERNAL_TOKEN, valid_features_payload


class TestInboundAuth:
    def test_healthz_without_token_returns_200(
        self, unauthenticated_client: httpx.Client
    ) -> None:
        """/healthz is exempt — probes must not need the secret."""
        response = unauthenticated_client.get("/healthz")
        assert response.status_code == 200

    def test_predict_without_token_returns_401(
        self, unauthenticated_client: httpx.Client
    ) -> None:
        response = unauthenticated_client.post(
            "/predict", json={"features": valid_features_payload()}
        )
        assert response.status_code == 401
        body = response.json()
        assert body["success"] is False
        assert body["error"]["code"] == "UNAUTHORIZED"
        assert "x-internal-token" in body["error"]["message"]

    def test_predict_with_wrong_token_returns_401(
        self, unauthenticated_client: httpx.Client
    ) -> None:
        response = unauthenticated_client.post(
            "/predict",
            json={"features": valid_features_payload()},
            headers={"x-internal-token": "definitely-not-the-real-token"},
        )
        assert response.status_code == 401
        body = response.json()
        assert body["success"] is False
        assert body["error"]["code"] == "UNAUTHORIZED"

    def test_predict_with_correct_token_returns_200(
        self, unauthenticated_client: httpx.Client
    ) -> None:
        response = unauthenticated_client.post(
            "/predict",
            json={"features": valid_features_payload()},
            headers={"x-internal-token": TEST_INTERNAL_TOKEN},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["predicted_price"] == 250_000.0

    def test_predict_batch_without_token_returns_401(
        self, unauthenticated_client: httpx.Client
    ) -> None:
        response = unauthenticated_client.post(
            "/predict/batch",
            json={"features": [valid_features_payload()]},
        )
        assert response.status_code == 401

    def test_model_info_without_token_returns_401(
        self, unauthenticated_client: httpx.Client
    ) -> None:
        response = unauthenticated_client.get("/model-info")
        assert response.status_code == 401

    def test_history_without_token_returns_401(
        self, unauthenticated_client: httpx.Client
    ) -> None:
        response = unauthenticated_client.get("/history")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Dev-mode fallback: empty env var disables the check
# ---------------------------------------------------------------------------


class TestDevModeFallback:
    def test_empty_token_lets_all_requests_through(
        self, monkeypatch: pytest.MonkeyPatch, app
    ) -> None:
        """When ``INTERNAL_SERVICE_TOKEN`` is empty, the check is skipped.

        This is the dev-mode safety hatch: probes still work and no calls
        are rejected. Production deploys MUST set the env var.
        """
        from app.core.config import settings
        from fastapi.testclient import TestClient

        monkeypatch.setattr(settings, "internal_service_token", "")
        # Build a TestClient with NO default headers — mimics a probe
        # that doesn't know the secret.
        client = TestClient(app)

        # Without any header — should pass (dev mode)
        response = client.post("/predict", json={"features": valid_features_payload()})
        assert response.status_code == 200
        assert response.json()["success"] is True

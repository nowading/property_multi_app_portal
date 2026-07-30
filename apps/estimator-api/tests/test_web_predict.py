"""Integration tests for ``POST /predict`` and ``POST /predict/batch``."""

from __future__ import annotations

from datetime import datetime

import httpx

from tests.conftest import valid_features_payload


# ---------------------------------------------------------------------------
# POST /predict
# ---------------------------------------------------------------------------


class TestPredict:
    def test_returns_prediction_envelope(self, client: httpx.Client) -> None:
        response = client.post(
            "/predict",
            json={"features": valid_features_payload()},
        )
        assert response.status_code == 200
        body = response.json()

        assert body["success"] is True
        assert body["error"] is None

        data = body["data"]
        assert data["predicted_price"] == 250_000.0
        assert data["features"]["square_footage"] == 2000.0
        # Timestamp must be ISO-format parseable
        datetime.fromisoformat(data["timestamp"])

    def test_sets_no_store_cache_control(self, client: httpx.Client) -> None:
        response = client.post("/predict", json={"features": valid_features_payload()})
        assert response.headers["cache-control"] == "no-store"

    def test_invalid_features_returns_envelope_422(self, client: httpx.Client) -> None:
        """Pydantic validation errors must be wrapped in the unified envelope."""
        # school_rating out of range [1, 10]
        payload = {"features": valid_features_payload(school_rating=15.0)}
        response = client.post("/predict", json=payload)

        assert response.status_code == 422
        body = response.json()
        assert body["success"] is False
        assert body["data"] is None
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert "school_rating" in body["error"]["message"]

    def test_missing_features_field_returns_422(self, client: httpx.Client) -> None:
        response = client.post("/predict", json={})
        assert response.status_code == 422
        body = response.json()
        assert body["error"]["code"] == "VALIDATION_ERROR"

    def test_extra_field_returns_422(self, client: httpx.Client) -> None:
        """``extra='forbid'`` on DTOs rejects unknown fields."""
        payload = {"features": valid_features_payload(), "rogue": "value"}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422
        body = response.json()
        assert body["error"]["code"] == "VALIDATION_ERROR"

    def test_ml_timeout_returns_504_envelope(
        self, fake_model, client: httpx.Client
    ) -> None:
        from app.domain import ModelTimeoutError

        fake_model._error = ModelTimeoutError("ML read timeout")
        response = client.post("/predict", json={"features": valid_features_payload()})

        assert response.status_code == 504
        body = response.json()
        assert body["success"] is False
        assert body["error"]["code"] == "ML_SERVICE_TIMEOUT"
        assert "ML read timeout" in body["error"]["message"]

    def test_ml_unavailable_returns_503_envelope(
        self, fake_model, client: httpx.Client
    ) -> None:
        from app.domain import ModelUnavailableError

        fake_model._error = ModelUnavailableError("connection refused")
        response = client.post("/predict", json={"features": valid_features_payload()})

        assert response.status_code == 503
        body = response.json()
        assert body["error"]["code"] == "ML_SERVICE_UNAVAILABLE"

    def test_ml_inference_error_returns_502_envelope(
        self, fake_model, client: httpx.Client
    ) -> None:
        from app.domain import ModelInferenceError

        fake_model._error = ModelInferenceError("ML returned garbage")
        response = client.post("/predict", json={"features": valid_features_payload()})

        assert response.status_code == 502
        body = response.json()
        assert body["error"]["code"] == "ML_INFERENCE_ERROR"


# ---------------------------------------------------------------------------
# POST /predict/batch
# ---------------------------------------------------------------------------


class TestPredictBatch:
    def test_returns_batch_envelope(self, client: httpx.Client) -> None:
        payload = {
            "features": [
                valid_features_payload(square_footage=1000.0),
                valid_features_payload(square_footage=2000.0),
            ]
        }
        response = client.post("/predict/batch", json=payload)
        assert response.status_code == 200
        body = response.json()

        assert body["success"] is True
        data = body["data"]
        assert data["total"] == 2
        assert len(data["predictions"]) == 2
        assert all(p["predicted_price"] == 250_000.0 for p in data["predictions"])

    def test_sets_no_store_cache_control(self, client: httpx.Client) -> None:
        payload = {"features": [valid_features_payload()]}
        response = client.post("/predict/batch", json=payload)
        assert response.headers["cache-control"] == "no-store"

    def test_empty_features_list_returns_422(self, client: httpx.Client) -> None:
        """``min_length=1`` on the batch list rejects empty batches."""
        response = client.post("/predict/batch", json={"features": []})
        assert response.status_code == 422
        body = response.json()
        assert body["error"]["code"] == "VALIDATION_ERROR"

    def test_invalid_item_in_batch_returns_422(self, client: httpx.Client) -> None:
        payload = {
            "features": [
                valid_features_payload(),
                valid_features_payload(bedrooms=-1),  # invalid
            ]
        }
        response = client.post("/predict/batch", json=payload)
        assert response.status_code == 422
        body = response.json()
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert "bedrooms" in body["error"]["message"]

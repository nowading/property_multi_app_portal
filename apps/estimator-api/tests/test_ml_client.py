"""Unit tests for the ML client adapter (Phase 3.3).

Uses ``httpx.MockTransport`` to stub HTTP responses — no real network calls.
Verifies success paths and the full error-mapping matrix required by
agent_rules.md §3.2 (timeouts → typed domain errors, no 500 leaks).
"""

from __future__ import annotations

import json
from datetime import timezone

import httpx
import pytest

from app.adapters.ml_client import HttpxModelInference
from app.domain import (
    ModelInferenceError,
    ModelInfo,
    ModelTimeoutError,
    ModelUnavailableError,
    PropertyFeatures,
)


# ---------------------------------------------------------------------------
# Helpers
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


def make_client(
    handler,
    *,
    base_url: str = "http://ml.test",
) -> HttpxModelInference:
    """Build an adapter backed by a MockTransport using ``handler``."""
    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport, base_url=base_url)
    return HttpxModelInference(base_url=base_url, client=client)


def predict_response(price: float) -> dict:
    return {"prediction": price}


def batch_response(prices: list[float]) -> dict:
    return {
        "predictions": [{"id": i, "price": p} for i, p in enumerate(prices)],
        "total": len(prices),
    }


def model_info_payload() -> dict:
    return {
        "model_type": "LinearRegression",
        "coefficients": {"square_footage": 112.45, "bedrooms": -2345.60},
        "intercept": -186320.45,
        "metrics": {"r_squared": 0.87, "rmse": 25430.15, "mae": 18200.42},
        "training_date": "2026-07-29T10:00:00Z",
        "n_samples_trained": "<dynamic>",
        "excluded_features": ["id", "price"],
    }


def health_payload(status: str = "healthy", model_loaded: bool = True) -> dict:
    return {
        "status": status,
        "timestamp": "2026-07-29T10:00:00Z",
        "model_loaded": model_loaded,
    }


# ---------------------------------------------------------------------------
# predict()
# ---------------------------------------------------------------------------


class TestPredict:
    async def test_returns_prediction_result(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/predict"
            body = json.loads(request.content)
            assert body == {"features": make_features().to_payload()}
            return httpx.Response(200, json=predict_response(245_620.35))

        adapter = make_client(handler)
        result = await adapter.predict(make_features())
        await adapter.aclose()

        assert result.predicted_price == 245_620.35
        assert result.features.square_footage == 2000.0
        # Timestamp must be tz-aware UTC
        assert result.timestamp.tzinfo is timezone.utc

    async def test_accepts_integer_prediction(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"prediction": 300000})

        adapter = make_client(handler)
        result = await adapter.predict(make_features())
        await adapter.aclose()
        assert result.predicted_price == 300_000.0
        assert isinstance(result.predicted_price, float)

    async def test_missing_prediction_field_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"wrong_key": 100})

        adapter = make_client(handler)
        with pytest.raises(ModelInferenceError, match="missing 'prediction'"):
            await adapter.predict(make_features())
        await adapter.aclose()

    async def test_wrong_prediction_type_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"prediction": "expensive"})

        adapter = make_client(handler)
        with pytest.raises(ModelInferenceError, match="unexpected type"):
            await adapter.predict(make_features())
        await adapter.aclose()

    async def test_http_500_raises_inference_error(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, text="Internal ML Error")

        adapter = make_client(handler)
        with pytest.raises(ModelInferenceError, match="HTTP 500"):
            await adapter.predict(make_features())
        await adapter.aclose()

    async def test_non_json_response_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, text="<html>not json</html>")

        adapter = make_client(handler)
        with pytest.raises(ModelInferenceError, match="non-JSON"):
            await adapter.predict(make_features())
        await adapter.aclose()

    async def test_connect_error_raises_unavailable(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        adapter = make_client(handler)
        with pytest.raises(ModelUnavailableError, match="Cannot connect"):
            await adapter.predict(make_features())
        await adapter.aclose()

    async def test_connect_timeout_raises_unavailable(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectTimeout("connect timed out")

        adapter = make_client(handler)
        with pytest.raises(ModelUnavailableError, match="connect timeout"):
            await adapter.predict(make_features())
        await adapter.aclose()

    async def test_read_timeout_raises_timeout(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ReadTimeout("read timed out")

        adapter = make_client(handler)
        with pytest.raises(ModelTimeoutError, match="read timeout"):
            await adapter.predict(make_features())
        await adapter.aclose()


# ---------------------------------------------------------------------------
# predict_batch()
# ---------------------------------------------------------------------------


class TestPredictBatch:
    async def test_empty_input_short_circuits(self) -> None:
        called = {"count": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            called["count"] += 1
            return httpx.Response(200, json=batch_response([]))

        adapter = make_client(handler)
        result = await adapter.predict_batch([])
        await adapter.aclose()
        assert result == []
        assert called["count"] == 0  # no HTTP call made

    async def test_returns_predictions_in_order(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content)
            assert isinstance(body["features"], list)
            assert len(body["features"]) == 3
            return httpx.Response(200, json=batch_response([100.0, 200.0, 300.0]))

        adapter = make_client(handler)
        inputs = [
            make_features(square_footage=1000.0),
            make_features(square_footage=2000.0),
            make_features(square_footage=3000.0),
        ]
        results = await adapter.predict_batch(inputs)
        await adapter.aclose()

        assert [r.predicted_price for r in results] == [100.0, 200.0, 300.0]
        assert [r.features for r in results] == inputs

    async def test_count_mismatch_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            # Asked for 3, returned 2
            return httpx.Response(200, json=batch_response([100.0, 200.0]))

        adapter = make_client(handler)
        inputs = [
            make_features(),
            make_features(),
            make_features(),
        ]
        with pytest.raises(ModelInferenceError, match="returned 2 predictions for 3"):
            await adapter.predict_batch(inputs)
        await adapter.aclose()

    async def test_missing_predictions_field_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"total": 0})

        adapter = make_client(handler)
        with pytest.raises(ModelInferenceError, match="missing 'predictions'"):
            await adapter.predict_batch([make_features()])
        await adapter.aclose()

    async def test_item_missing_price_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={"predictions": [{"id": 0, "value": 100}], "total": 1},
            )

        adapter = make_client(handler)
        with pytest.raises(ModelInferenceError, match="missing 'price'"):
            await adapter.predict_batch([make_features()])
        await adapter.aclose()

    async def test_unordered_predictions_are_sorted_by_id(self) -> None:
        """ML container may return items out of order — adapter sorts by id."""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "predictions": [
                        {"id": 2, "price": 300.0},
                        {"id": 0, "price": 100.0},
                        {"id": 1, "price": 200.0},
                    ],
                    "total": 3,
                },
            )

        adapter = make_client(handler)
        inputs = [
            make_features(square_footage=1000.0),
            make_features(square_footage=2000.0),
            make_features(square_footage=3000.0),
        ]
        results = await adapter.predict_batch(inputs)
        await adapter.aclose()

        # After sorting by id, prices match input order
        assert [r.predicted_price for r in results] == [100.0, 200.0, 300.0]
        assert [r.features for r in results] == inputs


# ---------------------------------------------------------------------------
# get_model_info()
# ---------------------------------------------------------------------------


class TestGetModelInfo:
    async def test_returns_parsed_model_info(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/model-info"
            return httpx.Response(200, json=model_info_payload())

        adapter = make_client(handler)
        info = await adapter.get_model_info()
        await adapter.aclose()

        assert info.model_type == "LinearRegression"
        assert info.coefficients == {"square_footage": 112.45, "bedrooms": -2345.60}
        assert info.intercept == -186320.45
        assert info.metrics["r_squared"] == 0.87
        assert info.training_date == "2026-07-29T10:00:00Z"
        assert info.n_samples_trained == "<dynamic>"
        assert info.excluded_features == ["id", "price"]

    async def test_missing_required_field_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            payload = model_info_payload()
            del payload["intercept"]
            return httpx.Response(200, json=payload)

        adapter = make_client(handler)
        with pytest.raises(ModelInferenceError, match="missing fields"):
            await adapter.get_model_info()
        await adapter.aclose()

    async def test_coefficients_wrong_type_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            payload = model_info_payload()
            payload["coefficients"] = "not a dict"
            return httpx.Response(200, json=payload)

        adapter = make_client(handler)
        with pytest.raises(ModelInferenceError, match="coefficients.*object"):
            await adapter.get_model_info()
        await adapter.aclose()

    async def test_missing_excluded_features_defaults_to_empty(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            payload = model_info_payload()
            del payload["excluded_features"]
            return httpx.Response(200, json=payload)

        adapter = make_client(handler)
        info = await adapter.get_model_info()
        await adapter.aclose()
        assert info.excluded_features == []

    async def test_n_samples_trained_accepts_int(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            payload = model_info_payload()
            payload["n_samples_trained"] = 5000
            return httpx.Response(200, json=payload)

        adapter = make_client(handler)
        info = await adapter.get_model_info()
        await adapter.aclose()
        assert info.n_samples_trained == 5000


# ---------------------------------------------------------------------------
# is_healthy()
# ---------------------------------------------------------------------------


class TestIsHealthy:
    async def test_returns_true_when_healthy(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/health"
            return httpx.Response(200, json=health_payload())

        adapter = make_client(handler)
        assert await adapter.is_healthy() is True
        await adapter.aclose()

    async def test_returns_false_when_status_not_healthy(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=health_payload(status="degraded"))

        adapter = make_client(handler)
        assert await adapter.is_healthy() is False
        await adapter.aclose()

    async def test_returns_false_when_model_not_loaded(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=health_payload(model_loaded=False))

        adapter = make_client(handler)
        assert await adapter.is_healthy() is False
        await adapter.aclose()

    async def test_returns_false_on_http_500(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, text="ML error")

        adapter = make_client(handler)
        assert await adapter.is_healthy() is False
        await adapter.aclose()

    async def test_returns_false_on_connect_error(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("refused")

        adapter = make_client(handler)
        assert await adapter.is_healthy() is False
        await adapter.aclose()

    async def test_returns_false_on_non_json(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, text="not json")

        adapter = make_client(handler)
        assert await adapter.is_healthy() is False
        await adapter.aclose()


# ---------------------------------------------------------------------------
# Configuration & lifecycle
# ---------------------------------------------------------------------------


class TestAdapterLifecycle:
    def test_default_timeouts_are_set(self) -> None:
        adapter = HttpxModelInference(base_url="http://ml.test")
        # The timeout config is exposed on the underlying client
        timeout: httpx.Timeout = adapter._client.timeout
        assert timeout.connect == 2.0
        assert timeout.read == 5.0
        # Cleanup the client we just created
        # (aclose is async; tested elsewhere, but here we just verify construction)

    async def test_custom_timeouts_respected(self) -> None:
        adapter = HttpxModelInference(
            base_url="http://ml.test",
            connect_timeout=0.5,
            read_timeout=1.5,
        )
        timeout: httpx.Timeout = adapter._client.timeout
        assert timeout.connect == 0.5
        assert timeout.read == 1.5
        await adapter.aclose()

    async def test_aclose_closes_owned_client(self) -> None:
        adapter = HttpxModelInference(base_url="http://ml.test")
        await adapter.aclose()
        # Calling aclose twice should be safe (idempotent)
        await adapter.aclose()

    async def test_aclose_does_not_close_injected_client(self) -> None:
        """If the caller injected the client, the adapter must not close it."""
        transport = httpx.MockTransport(lambda r: httpx.Response(200, json={}))
        client = httpx.AsyncClient(transport=transport, base_url="http://ml.test")
        adapter = HttpxModelInference(base_url="http://ml.test", client=client)

        await adapter.aclose()
        # The client should still be usable
        assert not client.is_closed
        await client.aclose()

    async def test_base_url_trailing_slash_stripped(self) -> None:
        adapter = HttpxModelInference(base_url="http://ml.test/")
        assert adapter._base_url == "http://ml.test"
        await adapter.aclose()


# ---------------------------------------------------------------------------
# Outbound x-internal-token header (Phase B.3 / Task B.3)
# ---------------------------------------------------------------------------


class TestOutboundInternalToken:
    async def test_internal_token_set_as_default_header_when_provided(self) -> None:
        """When constructed with a token, every outbound request must carry it."""

        captured: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return httpx.Response(200, json=predict_response(100.0))

        # Build the adapter with a MockTransport-backed client *and* the
        # token. The constructor applies the header as a default on the
        # internally-created AsyncClient, so even though we inject a
        # transport via ``httpx.MockTransport``, the adapter creates its
        # own client underneath and the default header is applied.
        adapter = HttpxModelInference(
            base_url="http://ml.test",
            internal_service_token="secret-123",
        )
        # Swap the owned client for a MockTransport-backed one (without
        # losing the default headers — we copy them over).
        transport = httpx.MockTransport(handler)
        await adapter._client.aclose()
        adapter._client = httpx.AsyncClient(
            transport=transport,
            base_url="http://ml.test",
            headers=adapter._client.headers,
        )

        await adapter.predict(make_features())
        await adapter.aclose()

        assert len(captured) == 1
        assert captured[0].headers.get("x-internal-token") == "secret-123"

    async def test_internal_token_absent_when_not_provided(self) -> None:
        """Without a token, no header is attached (backwards-compat default)."""

        async def handler(request: httpx.Request) -> httpx.Response:
            assert "x-internal-token" not in request.headers
            return httpx.Response(200, json=predict_response(100.0))

        adapter = HttpxModelInference(base_url="http://ml.test")
        transport = httpx.MockTransport(handler)
        await adapter._client.aclose()
        adapter._client = httpx.AsyncClient(
            transport=transport, base_url="http://ml.test"
        )

        await adapter.predict(make_features())
        await adapter.aclose()

    async def test_internal_token_sent_on_model_info(self) -> None:
        """The token is a default header — every method, not just predict."""

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.headers.get("x-internal-token") == "tok-xyz"
            return httpx.Response(200, json=model_info_payload())

        adapter = HttpxModelInference(
            base_url="http://ml.test",
            internal_service_token="tok-xyz",
        )
        transport = httpx.MockTransport(handler)
        await adapter._client.aclose()
        adapter._client = httpx.AsyncClient(
            transport=transport,
            base_url="http://ml.test",
            headers=adapter._client.headers,
        )

        await adapter.get_model_info()
        await adapter.aclose()

    async def test_internal_token_empty_string_treated_as_unset(self) -> None:
        """An empty string is treated the same as ``None`` — no header sent."""

        async def handler(request: httpx.Request) -> httpx.Response:
            assert "x-internal-token" not in request.headers
            return httpx.Response(200, json=health_payload())

        adapter = HttpxModelInference(
            base_url="http://ml.test", internal_service_token=""
        )
        transport = httpx.MockTransport(handler)
        await adapter._client.aclose()
        adapter._client = httpx.AsyncClient(
            transport=transport, base_url="http://ml.test"
        )

        await adapter.is_healthy()
        await adapter.aclose()


# ---------------------------------------------------------------------------
# Phase C: TLS verify (CA bundle) handling
# ---------------------------------------------------------------------------


class TestTlsVerify:
    async def test_verify_string_resolved_to_ssl_context(self) -> None:
        """When ``verify`` is a path, the adapter converts it to an SSLContext.

        We use the real project CA cert that is generated by
        ``scripts/generate_certs.py`` so the SSL context can be loaded
        successfully. If the cert is missing, the test is skipped.
        """
        import ssl
        from pathlib import Path

        ca_path = Path(__file__).resolve().parents[3] / "certs" / "ca.crt"
        if not ca_path.exists():
            pytest.skip("certs/ca.crt not generated yet — run scripts/generate_certs.py")

        adapter = HttpxModelInference(
            base_url="https://ml.test",
            verify=str(ca_path),
        )
        assert isinstance(adapter._verify, ssl.SSLContext)
        await adapter.aclose()

    async def test_verify_false_disables_tls_check(self) -> None:
        adapter = HttpxModelInference(
            base_url="https://ml.test",
            verify=False,
        )
        assert adapter._verify is False
        await adapter.aclose()

    async def test_default_verify_is_true(self) -> None:
        """When no verify is passed, the default is True (httpx system CA)."""
        adapter = HttpxModelInference(base_url="https://ml.test")
        assert adapter._verify is True
        await adapter.aclose()

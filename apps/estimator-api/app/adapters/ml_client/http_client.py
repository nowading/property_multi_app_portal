"""HTTP adapter for the ML model container.

Implements ``ModelInferencePort`` and ``HealthPort`` using ``httpx.AsyncClient``
with explicit Connect=2s / Read=5s timeouts (per agent_rules.md §3.2).

Failure mapping:
- ``httpx.ConnectError`` / ``httpx.ConnectTimeout`` → ``ModelUnavailableError``
- ``httpx.ReadTimeout``                            → ``ModelTimeoutError``
- HTTP 4xx/5xx                                    → ``ModelInferenceError``
- Malformed JSON / missing fields                 → ``ModelInferenceError``
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.domain import (
    ModelInferenceError,
    ModelInfo,
    ModelTimeoutError,
    ModelUnavailableError,
    PredictionResult,
    PropertyFeatures,
)
from app.domain.ports import HealthPort, ModelInferencePort

logger = logging.getLogger(__name__)

# ML container endpoints (paths relative to base URL)
PREDICT_PATH = "/predict"
PREDICT_BATCH_PATH = "/predict/batch"
MODEL_INFO_PATH = "/model-info"
HEALTH_PATH = "/health"


class HttpxModelInference(ModelInferencePort, HealthPort):
    """Async ML container client backed by ``httpx``.

    The constructor accepts an optional ``client`` parameter so tests can
    inject an ``httpx.MockTransport``-backed client. When the adapter creates
    its own client, it owns the lifecycle and must be closed via ``aclose``.
    """

    def __init__(
        self,
        base_url: str,
        *,
        connect_timeout: float = 2.0,
        read_timeout: float = 5.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._connect_timeout = connect_timeout
        self._read_timeout = read_timeout
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=connect_timeout,
                read=read_timeout,
                write=5.0,
                pool=1.0,
            ),
            base_url=self._base_url,
        )

    async def aclose(self) -> None:
        """Release the underlying HTTP client if this adapter owns it."""
        if self._owns_client:
            await self._client.aclose()

    # ------------------------------------------------------------------
    # ModelInferencePort
    # ------------------------------------------------------------------

    async def predict(self, features: PropertyFeatures) -> PredictionResult:
        payload = {"features": features.to_payload()}
        data = await self._post_json(PREDICT_PATH, payload)
        price = self._extract_price(data)
        return PredictionResult(
            predicted_price=price,
            features=features,
            timestamp=datetime.now(timezone.utc),
        )

    async def predict_batch(
        self, features_list: list[PropertyFeatures]
    ) -> list[PredictionResult]:
        if not features_list:
            return []
        payload = {"features": [f.to_payload() for f in features_list]}
        data = await self._post_json(PREDICT_BATCH_PATH, payload)
        predictions = self._extract_batch_predictions(data)

        if len(predictions) != len(features_list):
            raise ModelInferenceError(
                f"ML batch returned {len(predictions)} predictions for "
                f"{len(features_list)} inputs"
            )

        ts = datetime.now(timezone.utc)
        return [
            PredictionResult(
                predicted_price=price,
                features=features_list[i],
                timestamp=ts,
            )
            for i, price in enumerate(predictions)
        ]

    async def get_model_info(self) -> ModelInfo:
        data = await self._get_json(MODEL_INFO_PATH)
        return self._parse_model_info(data)

    # ------------------------------------------------------------------
    # HealthPort
    # ------------------------------------------------------------------

    async def is_healthy(self) -> bool:
        """Return ``True`` only if the ML container reports ``status == healthy``.

        Any transport error or non-200 response yields ``False`` (rather than
        raising) — health probes must never throw to the caller.
        """
        try:
            response = await self._client.get(HEALTH_PATH)
            if response.status_code != 200:
                return False
            data = response.json()
            return bool(data.get("status") == "healthy" and data.get("model_loaded"))
        except httpx.HTTPError:
            return False
        except ValueError:  # JSON decode error
            return False

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await self._client.post(path, json=payload)
        except httpx.ConnectError as exc:
            raise ModelUnavailableError(
                f"Cannot connect to ML service at {self._base_url}: {exc}"
            ) from exc
        except httpx.ConnectTimeout as exc:
            raise ModelUnavailableError(
                f"ML service connect timeout (>{self._connect_timeout}s): {exc}"
            ) from exc
        except httpx.ReadTimeout as exc:
            raise ModelTimeoutError(
                f"ML service read timeout (>{self._read_timeout}s): {exc}"
            ) from exc
        except httpx.HTTPError as exc:
            # Catch-all for the remaining httpx error subclasses
            # (WriteTimeout, PoolTimeout, RemoteProtocolError, etc.)
            raise ModelUnavailableError(f"ML service HTTP error: {exc}") from exc

        return self._handle_response(response, path)

    async def _get_json(self, path: str) -> dict[str, Any]:
        try:
            response = await self._client.get(path)
        except httpx.ConnectError as exc:
            raise ModelUnavailableError(
                f"Cannot connect to ML service at {self._base_url}: {exc}"
            ) from exc
        except httpx.ConnectTimeout as exc:
            raise ModelUnavailableError(
                f"ML service connect timeout (>{self._connect_timeout}s): {exc}"
            ) from exc
        except httpx.ReadTimeout as exc:
            raise ModelTimeoutError(
                f"ML service read timeout (>{self._read_timeout}s): {exc}"
            ) from exc
        except httpx.HTTPError as exc:
            raise ModelUnavailableError(f"ML service HTTP error: {exc}") from exc

        return self._handle_response(response, path)

    @staticmethod
    def _handle_response(response: httpx.Response, path: str) -> dict[str, Any]:
        if response.status_code >= 400:
            raise ModelInferenceError(
                f"ML service returned HTTP {response.status_code} for {path}: "
                f"{response.text[:200]}"
            )
        try:
            data = response.json()
        except ValueError as exc:
            raise ModelInferenceError(
                f"ML service returned non-JSON response for {path}: {exc}"
            ) from exc

        if not isinstance(data, dict):
            raise ModelInferenceError(
                f"ML service returned unexpected JSON type {type(data).__name__} "
                f"for {path}"
            )
        return data

    @staticmethod
    def _extract_price(data: dict[str, Any]) -> float:
        """Extract ``prediction`` from ``POST /predict`` response."""
        if "prediction" not in data:
            raise ModelInferenceError(
                f"ML /predict response missing 'prediction' field: {data}"
            )
        value = data["prediction"]
        if not isinstance(value, int | float):
            raise ModelInferenceError(
                f"ML /predict 'prediction' has unexpected type {type(value).__name__}"
            )
        return float(value)

    @staticmethod
    def _extract_batch_predictions(data: dict[str, Any]) -> list[float]:
        """Extract ordered price list from ``POST /predict/batch`` response.

        The ML container returns ``{"predictions": [{"id": 0, "price": 123}, ...], "total": N}``.
        We sort by ``id`` to guarantee input-order correspondence.
        """
        if "predictions" not in data:
            raise ModelInferenceError(
                f"ML /predict/batch response missing 'predictions' field: {data}"
            )
        raw = data["predictions"]
        if not isinstance(raw, list):
            raise ModelInferenceError(
                f"ML /predict/batch 'predictions' is not a list (got {type(raw).__name__})"
            )

        # Sort by id to preserve input order (defensive — the spec returns them in order)
        def _sort_key(item: Any) -> int:
            if isinstance(item, dict) and isinstance(item.get("id"), int):
                return item["id"]
            return 0

        sorted_raw = sorted(raw, key=_sort_key)

        prices: list[float] = []
        for i, item in enumerate(sorted_raw):
            if not isinstance(item, dict) or "price" not in item:
                raise ModelInferenceError(
                    f"ML /predict/batch item {i} missing 'price' field: {item}"
                )
            value = item["price"]
            if not isinstance(value, int | float):
                raise ModelInferenceError(
                    f"ML /predict/batch item {i} 'price' has type {type(value).__name__}"
                )
            prices.append(float(value))
        return prices

    @staticmethod
    def _parse_model_info(data: dict[str, Any]) -> ModelInfo:
        required = {
            "model_type",
            "coefficients",
            "intercept",
            "metrics",
            "training_date",
            "n_samples_trained",
        }
        missing = required - data.keys()
        if missing:
            raise ModelInferenceError(
                f"ML /model-info missing fields: {sorted(missing)}"
            )

        coefficients = data["coefficients"]
        metrics = data["metrics"]
        excluded = data.get("excluded_features", [])

        if not isinstance(coefficients, dict):
            raise ModelInferenceError("model-info 'coefficients' must be an object")
        if not isinstance(metrics, dict):
            raise ModelInferenceError("model-info 'metrics' must be an object")
        if not isinstance(excluded, list):
            raise ModelInferenceError("model-info 'excluded_features' must be a list")

        return ModelInfo(
            model_type=str(data["model_type"]),
            coefficients={str(k): float(v) for k, v in coefficients.items()},
            intercept=float(data["intercept"]),
            metrics={str(k): float(v) for k, v in metrics.items()},
            training_date=str(data["training_date"]),
            n_samples_trained=data["n_samples_trained"],  # int or "<dynamic>"
            excluded_features=[str(x) for x in excluded],
        )

"""ML container HTTP client adapter."""

from app.adapters.ml_client.http_client import (
    HEALTH_PATH,
    MODEL_INFO_PATH,
    PREDICT_BATCH_PATH,
    PREDICT_PATH,
    HttpxModelInference,
)

__all__ = [
    "HEALTH_PATH",
    "HttpxModelInference",
    "MODEL_INFO_PATH",
    "PREDICT_BATCH_PATH",
    "PREDICT_PATH",
]

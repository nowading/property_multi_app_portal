"""Domain-level error hierarchy.

These errors are framework-agnostic and raised by the domain/application
layers. Web adapters translate them into the unified API envelope
(``error.code`` / ``error.message``) and appropriate HTTP status codes.
"""

from __future__ import annotations


class DomainError(Exception):
    """Base class for all domain-level errors."""

    code: str = "DOMAIN_ERROR"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code


class ValidationError(DomainError):
    """Raised when a domain invariant is violated by input data."""

    code = "VALIDATION_ERROR"


class ModelInferenceError(DomainError):
    """Raised when the ML model returns an unexpected or malformed response."""

    code = "ML_INFERENCE_ERROR"


class ModelTimeoutError(DomainError):
    """Raised when the ML service fails to respond within the timeout."""

    code = "ML_SERVICE_TIMEOUT"


class ModelUnavailableError(DomainError):
    """Raised when the ML service cannot be reached (connection refused, DNS, etc.)."""

    code = "ML_SERVICE_UNAVAILABLE"

"""Exception → unified envelope mapping.

Domain errors raised by the application layer are translated here into HTTP
responses that follow the unified envelope:

    { "success": false, "data": null, "error": { "code": "...", "message": "..." } }

Status code mapping follows agent_rules.md §3.4:
- ValidationError          → 422
- ModelTimeoutError        → 504 (Gateway Timeout)
- ModelUnavailableError    → 503 (Service Unavailable)
- ModelInferenceError      → 502 (Bad Gateway)
- DomainError (other)      → 500
- ValueError (404-like)    → 404
- Exception (fallback)     → 500 with INTERNAL_ERROR

Pydantic ``RequestValidationError`` is left to FastAPI's default behaviour
(which itself returns a 422 with field-level errors) but wrapped in the
unified envelope so the frontend sees a consistent shape.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.envelope import error_response
from app.domain import (
    DomainError,
    ModelInferenceError,
    ModelTimeoutError,
    ModelUnavailableError,
    ValidationError,
)

logger = logging.getLogger(__name__)


# Status code mapping per domain error class
_STATUS_BY_DOMAIN_ERROR: dict[type[DomainError], int] = {
    ValidationError: 422,
    ModelTimeoutError: 504,
    ModelUnavailableError: 503,
    ModelInferenceError: 502,
}


def _envelope_json(code: str, message: str, status: int) -> JSONResponse:
    body = error_response(code, message).model_dump()
    return JSONResponse(status_code=status, content=body)


def register_error_handlers(app: FastAPI) -> None:
    """Attach all exception handlers to the FastAPI app."""

    @app.exception_handler(ValidationError)
    async def _validation_error_handler(_request: Request, exc: ValidationError) -> JSONResponse:
        return _envelope_json(exc.code, exc.message, 422)

    @app.exception_handler(ModelTimeoutError)
    async def _model_timeout_handler(_request: Request, exc: ModelTimeoutError) -> JSONResponse:
        return _envelope_json(exc.code, exc.message, 504)

    @app.exception_handler(ModelUnavailableError)
    async def _model_unavailable_handler(
        _request: Request, exc: ModelUnavailableError
    ) -> JSONResponse:
        return _envelope_json(exc.code, exc.message, 503)

    @app.exception_handler(ModelInferenceError)
    async def _model_inference_handler(
        _request: Request, exc: ModelInferenceError
    ) -> JSONResponse:
        return _envelope_json(exc.code, exc.message, 502)

    @app.exception_handler(DomainError)
    async def _domain_error_handler(_request: Request, exc: DomainError) -> JSONResponse:
        # Subclasses are caught by their specific handlers above; this catches
        # only the base DomainError and any subclass without a dedicated handler.
        status = _STATUS_BY_DOMAIN_ERROR.get(type(exc), 500)
        return _envelope_json(exc.code, exc.message, status)

    @app.exception_handler(RequestValidationError)
    async def _request_validation_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Wrap Pydantic's 422 in the unified envelope."""
        # Reuse the default error formatting but normalise into one message
        errors: list[dict[str, Any]] = exc.errors()
        if errors:
            first = errors[0]
            loc = ".".join(str(p) for p in first.get("loc", []))
            message = f"{first.get('msg', 'Invalid request')}"
            if loc:
                message = f"{loc}: {message}"
        else:
            message = "Request validation failed"
        return _envelope_json("VALIDATION_ERROR", message, 422)

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Last-resort handler — never leak 500s without the envelope."""
        logger.exception(
            "unhandled_exception path=%s method=%s error=%s",
            request.url.path,
            request.method,
            exc,
        )
        return _envelope_json(
            "INTERNAL_ERROR",
            "An unexpected error occurred. Please try again later.",
            500,
        )

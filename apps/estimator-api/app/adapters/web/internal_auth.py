"""ASGI middleware: validate ``x-internal-token`` on every non-health inbound request.

Reads the configured token from ``app.core.config.settings`` at startup
(resolved from the ``INTERNAL_SERVICE_TOKEN`` env var). Compares the
incoming ``x-internal-token`` header to the configured value using a
constant-time SHA-256 digest compare — the same algorithm used by the ML
container's ``app.core.auth`` module.

Behaviour:
- ``/healthz`` is exempt so liveness probes (k8s, Docker healthcheck,
  monitoring agents) never need the secret.
- If the env var is empty, the middleware logs a single startup warning
  and lets all requests through (dev-mode safety hatch). Hardened
  deployments MUST set ``INTERNAL_SERVICE_TOKEN``.
- If the env var is set and the header is missing or mismatched, returns
  ``401`` with the unified error envelope.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.envelope import error_response

logger = logging.getLogger(__name__)

INTERNAL_TOKEN_HEADER = "x-internal-token"
"""Header name carrying the shared secret on inbound requests."""

# Routes that bypass the token check. Health probes must not require
# auth — neither Docker healthchecks nor the dashboard should need to
# distribute the secret to third-party probe agents.
HEALTH_EXEMPT_PATHS: frozenset[str] = frozenset({"/healthz"})


def _token_matches(presented: str, expected: str) -> bool:
    """Constant-time comparison of two tokens.

    SHA-256 each side first (so the digest length is fixed and the
    compare is purely over 32-byte buffers) and then hand off to
    ``hmac.compare_digest`` for the timing-safe equality test.
    """
    digest_a = hashlib.sha256(presented.encode("utf-8")).digest()
    digest_b = hashlib.sha256(expected.encode("utf-8")).digest()
    return hmac.compare_digest(digest_a, digest_b)


class InternalAuthMiddleware(BaseHTTPMiddleware):
    """Reject non-health requests missing a matching ``x-internal-token``."""

    def __init__(self, app: ASGIApp, *, expected_token: str | None = None) -> None:
        super().__init__(app)
        # ``expected_token=None`` means "read from settings at request
        # time" — the default for production. Tests may inject a literal
        # token (or an empty string to disable) to avoid coupling to
        # the live settings instance.
        self._injected_token = expected_token
        if expected_token is None and not settings.internal_service_token:
            logger.warning(
                "INTERNAL_SERVICE_TOKEN is not set; inbound auth is disabled. "
                "This is unsafe in production."
            )

    @property
    def _expected(self) -> str:
        if self._injected_token is not None:
            return self._injected_token
        return settings.internal_service_token

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.url.path in HEALTH_EXEMPT_PATHS:
            return await call_next(request)

        expected = self._expected
        if not expected:
            # Dev mode — no token configured, let it through.
            return await call_next(request)

        presented = request.headers.get(INTERNAL_TOKEN_HEADER)
        if not presented:
            body = error_response(
                "UNAUTHORIZED", "Missing x-internal-token header"
            ).model_dump()
            return JSONResponse(status_code=401, content=body)

        if not _token_matches(presented, expected):
            body = error_response(
                "UNAUTHORIZED", "Invalid internal service token"
            ).model_dump()
            return JSONResponse(status_code=401, content=body)

        return await call_next(request)

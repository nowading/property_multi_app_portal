"""ASGI middleware: assign trace_id, log request lifecycle, propagate context.

Behaviour:
1. On request, look for an inbound ``X-Request-ID`` header. If absent,
   generate a fresh UUID4.
2. Store the trace_id in ``request_context`` (a contextvar) so downstream
   ``logging`` calls include it automatically via ``JsonFormatter``.
3. Echo the trace_id back to the client in the ``X-Request-ID`` response header.
4. Emit a single JSON log line per request with method, path, status, and
   duration in milliseconds.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.request_context import RequestContext, request_context

logger = logging.getLogger("estimator_api.request")

REQUEST_ID_HEADER = "X-Request-ID"


class TraceIdMiddleware(BaseHTTPMiddleware):
    """Assigns / propagates ``X-Request-ID`` and logs each request."""

    def __init__(self, app: ASGIApp, *, service_name: str = "estimator-api") -> None:
        super().__init__(app)
        self._service_name = service_name

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # Resolve or generate the trace id
        trace_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())

        ctx = RequestContext(
            trace_id=trace_id,
            method=request.method,
            path=request.url.path,
        )
        token = request_context.set(ctx)

        start = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start) * 1000
            response.headers[REQUEST_ID_HEADER] = trace_id

            # Log inside the try block so the contextvar is still set when
            # the JsonFormatter pulls trace_id from request_context.
            logger.info(
                "request_completed",
                extra={
                    "http_method": request.method,
                    "http_path": request.url.path,
                    "http_status": response.status_code,
                    "duration_ms": round(duration_ms, 2),
                },
            )
            return response
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "request_failed",
                extra={
                    "http_method": request.method,
                    "http_path": request.url.path,
                    "duration_ms": round(duration_ms, 2),
                },
            )
            raise
        finally:
            request_context.reset(token)

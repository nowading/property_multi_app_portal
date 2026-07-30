"""Request-scoped context propagation via ``contextvars``.

The ``TraceIdMiddleware`` populates this context per request so that any
``logging`` call made downstream (in application code, adapters, etc.)
automatically includes the current ``trace_id`` without explicit threading.
"""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass


@dataclass(frozen=True)
class RequestContext:
    """Per-request context carried through the async call stack."""

    trace_id: str
    method: str
    path: str


# Module-level contextvar — defaults to ``None`` outside a request.
request_context: ContextVar[RequestContext | None] = ContextVar(
    "request_context", default=None
)


def get_trace_id() -> str | None:
    """Return the current request's trace_id, or ``None`` if not in a request."""
    ctx = request_context.get()
    return ctx.trace_id if ctx is not None else None

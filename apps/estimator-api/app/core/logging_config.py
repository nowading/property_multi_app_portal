"""Structured JSON logging configuration.

Outputs one JSON object per log record with the standard fields required by
agent_rules.md §3.3:
    timestamp, level, logger, message, service_name, trace_id

``trace_id`` is pulled from ``request_context`` (a contextvar set by the
TraceIdMiddleware). When no request is active (e.g. startup logs), it is
omitted from the output.

Usage::

    from app.core.logging import configure_logging
    configure_logging(service_name="estimator-api", log_level="INFO")
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

# Re-exported for tests that want to inspect/patch the contextvar.
from app.core.request_context import request_context


class JsonFormatter(logging.Formatter):
    """Emit each record as a single JSON line on stderr.

    Stdlib ``logging.Formatter`` only gives us ``format``; we override it to
    build a dict and ``json.dumps`` it. Extra fields attached via
    ``logger.info("msg", extra={...})`` are merged in.
    """

    # Standard LogRecord attributes that should NOT be merged into the JSON
    # payload as top-level keys (they're either already mapped above or are
    # internal bookkeeping). Anything else attached via ``extra=`` is kept.
    _STANDARD_ATTRS = frozenset({
        "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
        "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
        "created", "msecs", "relativeCreated", "thread", "threadName",
        "processName", "process", "message", "asctime",
        # taskName added in Python 3.12
        "taskName",
    })

    def __init__(self, service_name: str) -> None:
        super().__init__()
        self._service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service_name": self._service_name,
        }

        # Attach trace_id if a request is in flight
        ctx = request_context.get()
        if ctx is not None and ctx.trace_id:
            payload["trace_id"] = ctx.trace_id

        # Merge record.extra (anything not in the standard LogRecord attrs).
        # If the caller passed ``extra={"trace_id": "x"}``, that wins.
        for key, value in vars(record).items():
            if key in self._STANDARD_ATTRS or key.startswith("_"):
                continue
            payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


def configure_logging(service_name: str, log_level: str = "INFO") -> None:
    """Configure the root logger to emit JSON to stderr.

    Idempotent — calling it multiple times replaces the handler rather than
    stacking them (important for tests that call ``configure_logging`` per
    case).
    """
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(JsonFormatter(service_name=service_name))

    root = logging.getLogger()
    # Remove existing handlers to make this idempotent
    for existing in list(root.handlers):
        root.removeHandler(existing)
    root.addHandler(handler)
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))

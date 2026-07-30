"""Tests for structured JSON logging and trace_id middleware (Phase 3.6)."""

from __future__ import annotations

import io
import json
import logging
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.adapters.web.middleware import REQUEST_ID_HEADER, TraceIdMiddleware
from app.core.logging_config import JsonFormatter, configure_logging
from app.core.request_context import RequestContext, get_trace_id, request_context


# ---------------------------------------------------------------------------
# JsonFormatter
# ---------------------------------------------------------------------------


class TestJsonFormatter:
    def test_emits_required_fields(self) -> None:
        formatter = JsonFormatter(service_name="estimator-api")
        record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="hello %s",
            args=("world",),
            exc_info=None,
        )
        output = formatter.format(record)
        payload = json.loads(output)

        assert payload["message"] == "hello world"
        assert payload["level"] == "INFO"
        assert payload["logger"] == "test.logger"
        assert payload["service_name"] == "estimator-api"
        assert "timestamp" in payload
        # timestamp ends with Z (UTC)
        assert payload["timestamp"].endswith("Z")

    def test_includes_trace_id_when_request_context_set(self) -> None:
        formatter = JsonFormatter(service_name="estimator-api")
        record = logging.LogRecord(
            name="x", level=logging.INFO, pathname="x", lineno=1,
            msg="m", args=None, exc_info=None,
        )

        # Without context: no trace_id
        request_context.set(None)
        assert "trace_id" not in json.loads(formatter.format(record))

        # With context: trace_id present
        ctx = RequestContext(trace_id="abc-123", method="GET", path="/x")
        token = request_context.set(ctx)
        try:
            payload = json.loads(formatter.format(record))
            assert payload["trace_id"] == "abc-123"
        finally:
            request_context.reset(token)

    def test_includes_extra_fields(self) -> None:
        formatter = JsonFormatter(service_name="svc")
        record = logging.LogRecord(
            name="x", level=logging.INFO, pathname="x", lineno=1,
            msg="m", args=None, exc_info=None,
        )
        record.duration_ms = 42.5  # type: ignore[attr-defined]
        record.http_status = 200  # type: ignore[attr-defined]

        payload = json.loads(formatter.format(record))
        assert payload["duration_ms"] == 42.5
        assert payload["http_status"] == 200

    def test_includes_exception_info(self) -> None:
        formatter = JsonFormatter(service_name="svc")
        try:
            raise ValueError("boom")
        except ValueError:
            import sys

            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="x", level=logging.ERROR, pathname="x", lineno=1,
            msg="failed", args=None, exc_info=exc_info,
        )
        payload = json.loads(formatter.format(record))
        assert "exception" in payload
        assert "ValueError" in payload["exception"]
        assert "boom" in payload["exception"]


# ---------------------------------------------------------------------------
# configure_logging
# ---------------------------------------------------------------------------


class TestConfigureLogging:
    def test_replaces_existing_handlers(self) -> None:
        """Calling twice must not stack handlers (idempotent)."""
        root = logging.getLogger()
        # Start clean
        for h in list(root.handlers):
            root.removeHandler(h)

        configure_logging(service_name="a", log_level="DEBUG")
        assert len(root.handlers) == 1
        assert root.level == logging.DEBUG

        configure_logging(service_name="b", log_level="WARNING")
        assert len(root.handlers) == 1
        assert root.level == logging.WARNING
        assert root.handlers[0].formatter._service_name == "b"

    def test_logs_to_stderr(self) -> None:
        import sys

        configure_logging(service_name="test")
        root = logging.getLogger()
        assert any(
            isinstance(h, logging.StreamHandler) and h.stream is sys.stderr
            for h in root.handlers
        )


# ---------------------------------------------------------------------------
# TraceIdMiddleware
# ---------------------------------------------------------------------------


def _build_app() -> FastAPI:
    """Build a minimal app exposing only the middleware behaviour."""
    app = FastAPI()

    @app.get("/echo")
    async def echo(request: Request) -> JSONResponse:
        # While inside a request, get_trace_id() must return the current id
        return JSONResponse({"trace_id": get_trace_id()})

    app.add_middleware(TraceIdMiddleware, service_name="test")
    return app


class TestTraceIdMiddleware:
    def test_generates_trace_id_when_header_absent(self) -> None:
        app = _build_app()
        client = TestClient(app)

        response = client.get("/echo")
        assert response.status_code == 200

        trace_id = response.json()["trace_id"]
        assert trace_id is not None
        assert len(trace_id) > 0
        # The trace_id must be echoed back in the response header
        assert response.headers[REQUEST_ID_HEADER] == trace_id

    def test_propagates_inbound_request_id(self) -> None:
        app = _build_app()
        client = TestClient(app)

        response = client.get("/echo", headers={REQUEST_ID_HEADER: "client-trace-1"})
        assert response.json()["trace_id"] == "client-trace-1"
        assert response.headers[REQUEST_ID_HEADER] == "client-trace-1"

    def test_each_request_gets_distinct_trace_id(self) -> None:
        app = _build_app()
        client = TestClient(app)

        ids = {client.get("/echo").json()["trace_id"] for _ in range(5)}
        assert len(ids) == 5  # all distinct

    def test_trace_id_available_via_contextvar_in_handler(self) -> None:
        """The handler can read ``get_trace_id()`` synchronously."""
        app = _build_app()
        client = TestClient(app)
        response = client.get("/echo")
        assert response.json()["trace_id"] is not None


# ---------------------------------------------------------------------------
# Logging + middleware integration (logs include trace_id)
# ---------------------------------------------------------------------------


class TestLoggingIntegration:
    def test_request_log_includes_trace_id(self, caplog: pytest.LogCaptureFixture) -> None:
        """End-to-end: a request's log line must carry the request's trace_id."""
        # Configure JSON logging so the formatter pulls trace_id from contextvar
        configure_logging(service_name="estimator-api")

        app = _build_app()
        client = TestClient(app)

        # Capture the root logger's stream
        root = logging.getLogger()
        original_stream = root.handlers[0].stream
        captured = io.StringIO()
        root.handlers[0].stream = captured

        try:
            response = client.get(
                "/echo", headers={REQUEST_ID_HEADER: "trace-xyz-789"}
            )
            assert response.status_code == 200

            log_lines = captured.getvalue().strip().split("\n")
            assert len(log_lines) >= 1

            # At least one log line must contain the trace_id
            trace_found = False
            for line in log_lines:
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if payload.get("trace_id") == "trace-xyz-789":
                    trace_found = True
                    assert payload["service_name"] == "estimator-api"
                    assert "http_path" in payload
                    assert "http_method" in payload
                    break
            assert trace_found, "trace_id was not present in any request log line"
        finally:
            root.handlers[0].stream = original_stream

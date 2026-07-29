"""Unified API response envelope shared across all backend services.

Every REST response follows the shape:
    { "success": bool, "data": <any> | null, "error": { "code": str, "message": str } | null }
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str


class ApiResponse(BaseModel):
    success: bool
    data: Any | None = None
    error: ErrorDetail | None = None


def success_response(data: Any) -> ApiResponse:
    """Build a success envelope wrapping ``data``."""
    return ApiResponse(success=True, data=data, error=None)


def error_response(code: str, message: str) -> ApiResponse:
    """Build a failure envelope with a structured error."""
    return ApiResponse(success=False, data=None, error=ErrorDetail(code=code, message=message))

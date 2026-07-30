"""Web adapter — FastAPI routers, Pydantic v2 DTOs, and dependency wiring.

Routers under this package translate HTTP requests into application-layer
use case calls and serialise domain objects back into the unified envelope.
"""

from app.adapters.web.dependencies import (
    AdapterContainer,
    container,
    get_batch_predict_use_case,
    get_check_health_use_case,
    get_clear_history_use_case,
    get_delete_history_use_case,
    get_get_history_entry_use_case,
    get_get_model_info_use_case,
    get_history_repository,
    get_list_history_use_case,
    get_model_inference,
    get_predict_use_case,
    init_adapters,
    close_adapters,
)
from app.adapters.web.errors import register_error_handlers

__all__ = [
    "AdapterContainer",
    "close_adapters",
    "container",
    "get_batch_predict_use_case",
    "get_check_health_use_case",
    "get_clear_history_use_case",
    "get_delete_history_use_case",
    "get_get_history_entry_use_case",
    "get_get_model_info_use_case",
    "get_history_repository",
    "get_list_history_use_case",
    "get_model_inference",
    "get_predict_use_case",
    "init_adapters",
    "register_error_handlers",
]

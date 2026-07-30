"""Web adapter routers — each file defines an ``APIRouter`` for one resource.

This package re-exports the ``router`` instance from each module so callers
can ``include_router`` them directly.
"""

from app.adapters.web.routers.health_router import router as health_router
from app.adapters.web.routers.history_router import router as history_router
from app.adapters.web.routers.model_info_router import router as model_info_router
from app.adapters.web.routers.predict_router import router as predict_router

__all__ = [
    "health_router",
    "history_router",
    "model_info_router",
    "predict_router",
]

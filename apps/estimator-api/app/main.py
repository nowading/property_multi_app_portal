"""FastAPI application entry point for the Property Value Estimator API.

Wires the Clean Architecture layers together:
- ``lifespan`` initialises and tears down adapter singletons.
- Routers under ``app.adapters.web.routers`` mount the HTTP surface.
- ``register_error_handlers`` maps domain errors to the unified envelope.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.adapters.web import close_adapters, init_adapters, register_error_handlers
from app.adapters.web.middleware import TraceIdMiddleware
from app.adapters.web.routers import (
    health_router,
    history_router,
    model_info_router,
    predict_router,
)
from app.core.config import settings
from app.core.logging_config import configure_logging

# Configure structured JSON logging at import time so even startup messages
# are emitted in the correct format.
configure_logging(service_name="estimator-api", log_level=settings.log_level)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise adapter singletons on startup, release on shutdown."""
    init_adapters()
    logger.info(
        "estimator_api_startup",
        extra={"host": settings.estimator_api_host, "port": settings.estimator_api_port},
    )
    try:
        yield
    finally:
        await close_adapters()
        logger.info("estimator_api_shutdown")


def create_app() -> FastAPI:
    """Application factory — used by tests and the uvicorn entrypoint alike."""
    app = FastAPI(
        title="Property Value Estimator API",
        description="Backend for App 1 — Property Value Estimator (FastAPI).",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Register middleware (order matters: trace_id first so logs have context)
    app.add_middleware(TraceIdMiddleware, service_name="estimator-api")

    # Mount routers
    app.include_router(health_router)
    app.include_router(predict_router)
    app.include_router(model_info_router)
    app.include_router(history_router)

    # Map domain errors to the unified envelope
    register_error_handlers(app)

    return app


app = create_app()


def main() -> None:
    """Run the API with uvicorn using settings from the environment."""
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.estimator_api_host,
        port=settings.estimator_api_port,
        reload=False,
    )


if __name__ == "__main__":
    main()

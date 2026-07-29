"""FastAPI application entry point for the Property Value Estimator API."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI

from app.core.config import settings
from app.core.envelope import success_response

app = FastAPI(
    title="Property Value Estimator API",
    description="Backend for App 1 — Property Value Estimator (FastAPI).",
    version="0.1.0",
)


@app.get("/healthz")
async def healthz() -> dict:
    """Liveness probe returning a unified success envelope."""
    return success_response(
        {
            "status": "healthy",
            "service": "estimator-api",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    ).model_dump()


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

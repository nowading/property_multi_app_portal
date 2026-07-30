"""Router for ``GET /healthz`` — composite liveness probe.

Reports both the API's own liveness and the downstream ML service's health
so the operator can distinguish "API up, ML down" from "API down".
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.adapters.web.dependencies import get_check_health_use_case
from app.adapters.web.dtos import HealthDTO
from app.application import CheckHealthUseCase
from app.core.envelope import success_response

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz(use_case: CheckHealthUseCase = Depends(get_check_health_use_case)):
    """Return the API's health plus the downstream ML service's health."""
    # Health endpoints are intentionally not given Cache-Control headers —
    # callers (k8s probes, monitoring) expect fresh results every time.
    ml_healthy = await use_case.execute()

    payload = HealthDTO(
        status="healthy" if ml_healthy else "degraded",
        service="estimator-api",
        ml_healthy=ml_healthy,
        timestamp=datetime.now(timezone.utc),
    )
    return success_response(payload.model_dump(mode="json")).model_dump()

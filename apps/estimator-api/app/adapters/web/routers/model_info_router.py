"""Router for ``GET /model-info``.

Per PROJECT_PLAN §3.1, this endpoint is cacheable:
``Cache-Control: public, max-age=60, stale-while-revalidate=300``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.adapters.web.dependencies import get_get_model_info_use_case
from app.adapters.web.dtos import ModelInfoDTO
from app.application import GetModelInfoUseCase
from app.core.envelope import success_response

router = APIRouter(tags=["model-info"])

_CACHEABLE = "public, max-age=60, stale-while-revalidate=300"


@router.get("/model-info")
async def get_model_info(
    response: Response,
    use_case: GetModelInfoUseCase = Depends(get_get_model_info_use_case),
):
    """Return metadata about the trained ML model."""
    info = await use_case.execute()

    response.headers["Cache-Control"] = _CACHEABLE

    payload = ModelInfoDTO(
        model_type=info.model_type,
        coefficients=dict(info.coefficients),
        intercept=info.intercept,
        metrics=dict(info.metrics),
        training_date=info.training_date,
        n_samples_trained=info.n_samples_trained,
        excluded_features=list(info.excluded_features),
    )
    return success_response(payload.model_dump(mode="json")).model_dump()

"""Routers for prediction endpoints: ``POST /predict`` and ``POST /predict/batch``."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.adapters.web.dependencies import (
    get_batch_predict_use_case,
    get_predict_use_case,
)
from app.adapters.web.dtos import (
    BatchPredictRequest,
    BatchPredictionResultDTO,
    PredictionResultDTO,
    PredictRequest,
)
from app.application import BatchPredictUseCase, PredictUseCase
from app.core.envelope import success_response

router = APIRouter(tags=["predict"])

# Per PROJECT_PLAN §3.1: prediction endpoints are never cached.
_NO_STORE = "no-store"


@router.post("/predict")
async def predict(
    request: PredictRequest,
    response: Response,
    use_case: PredictUseCase = Depends(get_predict_use_case),
):
    """Predict the price of a single property."""
    features = request.features.to_domain()
    result = await use_case.execute(features)

    response.headers["Cache-Control"] = _NO_STORE

    payload = PredictionResultDTO(
        predicted_price=result.predicted_price,
        features=request.features,
        timestamp=result.timestamp,
    )
    return success_response(payload.model_dump(mode="json")).model_dump()


@router.post("/predict/batch")
async def predict_batch(
    request: BatchPredictRequest,
    response: Response,
    use_case: BatchPredictUseCase = Depends(get_batch_predict_use_case),
):
    """Predict prices for multiple properties in one call."""
    domain_features = [f.to_domain() for f in request.features]
    results = await use_case.execute(domain_features)

    response.headers["Cache-Control"] = _NO_STORE

    predictions = [
        PredictionResultDTO(
            predicted_price=r.predicted_price,
            features=request.features[i],
            timestamp=r.timestamp,
        )
        for i, r in enumerate(results)
    ]
    payload = BatchPredictionResultDTO(
        predictions=predictions,
        total=len(predictions),
    )
    return success_response(payload.model_dump(mode="json")).model_dump()

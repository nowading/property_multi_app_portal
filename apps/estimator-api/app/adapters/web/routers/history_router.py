"""Router for history endpoints.

- ``GET    /history``          — list all entries (newest first)
- ``GET    /history/{entry_id}`` — fetch a single entry
- ``DELETE /history/{entry_id}`` — delete a single entry
- ``DELETE /history``           — clear all entries

History is in-memory only; ``DELETE`` operations are not cached.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response

from app.adapters.web.dependencies import (
    get_clear_history_use_case,
    get_delete_history_use_case,
    get_get_history_entry_use_case,
    get_list_history_use_case,
)
from app.adapters.web.dtos import (
    HistoryClearResultDTO,
    HistoryDeleteResultDTO,
    HistoryEntryDTO,
    HistoryListDTO,
    PropertyFeaturesDTO,
)
from app.application import (
    ClearHistoryUseCase,
    DeleteHistoryUseCase,
    GetHistoryEntryUseCase,
    ListHistoryUseCase,
)
from app.core.envelope import success_response
from app.domain import HistoryEntry

router = APIRouter(prefix="/history", tags=["history"])

_NO_STORE = "no-store"


def _entry_to_dto(entry: HistoryEntry) -> HistoryEntryDTO:
    """Serialise a domain ``HistoryEntry`` to its DTO."""
    return HistoryEntryDTO(
        id=entry.id,
        features=PropertyFeaturesDTO(
            square_footage=entry.features.square_footage,
            bedrooms=entry.features.bedrooms,
            bathrooms=entry.features.bathrooms,
            year_built=entry.features.year_built,
            lot_size=entry.features.lot_size,
            distance_to_city_center=entry.features.distance_to_city_center,
            school_rating=entry.features.school_rating,
        ),
        predicted_price=entry.predicted_price,
        created_at=entry.created_at,
    )


@router.get("")
async def list_history(
    response: Response,
    use_case: ListHistoryUseCase = Depends(get_list_history_use_case),
):
    """Return all stored history entries, newest first."""
    # History is small (≤50) and per-process — caching the list would mask
    # new writes from other requests. Mark as no-store.
    response.headers["Cache-Control"] = _NO_STORE

    entries = await use_case.execute()
    payload = HistoryListDTO(
        entries=[_entry_to_dto(e) for e in entries],
        count=len(entries),
    )
    return success_response(payload.model_dump(mode="json")).model_dump()


@router.get("/{entry_id}")
async def get_history_entry(
    entry_id: str,
    response: Response,
    use_case: GetHistoryEntryUseCase = Depends(get_get_history_entry_use_case),
):
    """Return a single history entry by id."""
    response.headers["Cache-Control"] = _NO_STORE

    entry = await use_case.execute(entry_id)
    if entry is None:
        # Use the unified envelope via HTTPException → handled by errors.py
        raise HTTPException(status_code=404, detail="History entry not found")
    payload = _entry_to_dto(entry)
    return success_response(payload.model_dump(mode="json")).model_dump()


@router.delete("/{entry_id}")
async def delete_history_entry(
    entry_id: str,
    response: Response,
    use_case: DeleteHistoryUseCase = Depends(get_delete_history_use_case),
):
    """Delete a single history entry by id."""
    response.headers["Cache-Control"] = _NO_STORE

    deleted = await use_case.execute(entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="History entry not found")
    payload = HistoryDeleteResultDTO(deleted=True)
    return success_response(payload.model_dump(mode="json")).model_dump()


@router.delete("")
async def clear_history(
    response: Response,
    use_case: ClearHistoryUseCase = Depends(get_clear_history_use_case),
):
    """Remove all history entries."""
    response.headers["Cache-Control"] = _NO_STORE

    cleared = await use_case.execute()
    payload = HistoryClearResultDTO(cleared=cleared)
    return success_response(payload.model_dump(mode="json")).model_dump()

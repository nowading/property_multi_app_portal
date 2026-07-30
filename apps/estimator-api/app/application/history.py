"""History use cases — list / get / delete / clear.

These are thin coordinators around ``HistoryRepositoryPort``. Keeping them
as use cases (rather than letting the web adapter call the repository
directly) preserves the application-layer boundary so future cross-cutting
concerns (authorization, audit logging) have a natural home.
"""

from __future__ import annotations

from app.domain import HistoryEntry, HistoryRepositoryPort


class ListHistoryUseCase:
    """Return all stored history entries, newest first."""

    def __init__(self, history: HistoryRepositoryPort) -> None:
        self._history = history

    async def execute(self) -> list[HistoryEntry]:
        return await self._history.list()


class GetHistoryEntryUseCase:
    """Return a single history entry by id, or ``None`` if not found."""

    def __init__(self, history: HistoryRepositoryPort) -> None:
        self._history = history

    async def execute(self, entry_id: str) -> HistoryEntry | None:
        return await self._history.get(entry_id)


class DeleteHistoryUseCase:
    """Delete a single history entry. Return True if something was deleted."""

    def __init__(self, history: HistoryRepositoryPort) -> None:
        self._history = history

    async def execute(self, entry_id: str) -> bool:
        return await self._history.delete(entry_id)


class ClearHistoryUseCase:
    """Remove all history entries. Return the number of entries removed."""

    def __init__(self, history: HistoryRepositoryPort) -> None:
        self._history = history

    async def execute(self) -> int:
        return await self._history.clear()

"""In-memory history repository (persistence adapter).

Thread-safe via ``asyncio.Lock`` so concurrent FastAPI requests don't corrupt
the internal deque. Implements FIFO eviction at ``capacity`` (default 50) to
match the frontend's localStorage cap — backend and frontend caps are
intentionally aligned.
"""

from __future__ import annotations

import asyncio
from collections import deque

from app.domain import HistoryEntry, HistoryRepositoryPort


class InMemoryHistoryRepository(HistoryRepositoryPort):
    """Async-safe in-memory history store with FIFO eviction."""

    def __init__(self, capacity: int = 50) -> None:
        if capacity <= 0:
            raise ValueError(f"capacity must be > 0, got {capacity}")
        self._capacity = capacity
        # deque maxlen handles eviction automatically — appending to the right
        # when full silently drops the leftmost (oldest) entry.
        self._entries: deque[HistoryEntry] = deque(maxlen=capacity)
        self._index: dict[str, HistoryEntry] = {}
        self._lock = asyncio.Lock()

    @property
    def capacity(self) -> int:
        return self._capacity

    async def add(self, entry: HistoryEntry) -> HistoryEntry:
        async with self._lock:
            # If the entry id already exists (defensive), replace it in place
            # rather than inserting a duplicate.
            if entry.id in self._index:
                # Locate and replace — preserve position
                for i, existing in enumerate(self._entries):
                    if existing.id == entry.id:
                        self._entries[i] = entry
                        break
                self._index[entry.id] = entry
                return entry

            # Track if eviction will happen so we can keep the index in sync
            evicted: HistoryEntry | None = None
            if len(self._entries) == self._capacity:
                # deque will evict the leftmost; capture it to update the index
                evicted = self._entries[0]

            self._entries.append(entry)
            self._index[entry.id] = entry

            if evicted is not None:
                # Remove the evicted id from the index. If multiple entries
                # share that id (shouldn't happen with UUIDs), we keep the
                # newest by re-checking presence in the deque.
                if evicted.id not in {e.id for e in self._entries}:
                    self._index.pop(evicted.id, None)

            return entry

    async def list(self) -> list[HistoryEntry]:
        """Return entries newest-first (caller-friendly for UI rendering)."""
        async with self._lock:
            # deque stores oldest→newest (append to right); reverse for UI
            return list(reversed(self._entries))

    async def get(self, entry_id: str) -> HistoryEntry | None:
        async with self._lock:
            return self._index.get(entry_id)

    async def delete(self, entry_id: str) -> bool:
        async with self._lock:
            if entry_id not in self._index:
                return False
            # Linear scan — acceptable for ≤50 entries
            for i, entry in enumerate(self._entries):
                if entry.id == entry_id:
                    del self._entries[i]
                    self._index.pop(entry_id, None)
                    return True
            return False

    async def clear(self) -> int:
        async with self._lock:
            count = len(self._entries)
            self._entries.clear()
            self._index.clear()
            return count

    async def count(self) -> int:
        """Return the current number of stored entries (not in port — utility)."""
        async with self._lock:
            return len(self._entries)

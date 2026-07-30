"""Unit tests for the in-memory history repository (Phase 3.5)."""

from __future__ import annotations

import asyncio

import pytest

from app.adapters.persistence import InMemoryHistoryRepository
from app.domain import HistoryEntry, PropertyFeatures


def make_features(**overrides: object) -> PropertyFeatures:
    base: dict[str, object] = {
        "square_footage": 2000.0,
        "bedrooms": 3,
        "bathrooms": 2.5,
        "year_built": 1990,
        "lot_size": 5000.0,
        "distance_to_city_center": 5.5,
        "school_rating": 8.0,
    }
    base.update(overrides)
    return PropertyFeatures(**base)


def make_entry(price: float = 100.0, **overrides: object) -> HistoryEntry:
    return HistoryEntry.create(
        features=make_features(**overrides),
        predicted_price=price,
    )


class TestConstruction:
    def test_default_capacity_is_50(self) -> None:
        repo = InMemoryHistoryRepository()
        assert repo.capacity == 50

    def test_custom_capacity(self) -> None:
        repo = InMemoryHistoryRepository(capacity=10)
        assert repo.capacity == 10

    def test_invalid_capacity_raises(self) -> None:
        with pytest.raises(ValueError, match="capacity"):
            InMemoryHistoryRepository(capacity=0)
        with pytest.raises(ValueError, match="capacity"):
            InMemoryHistoryRepository(capacity=-1)


class TestAddAndList:
    async def test_add_single_entry(self) -> None:
        repo = InMemoryHistoryRepository()
        entry = make_entry(price=250_000.0)
        result = await repo.add(entry)
        assert result is entry

        items = await repo.list()
        assert items == [entry]

    async def test_list_returns_newest_first(self) -> None:
        repo = InMemoryHistoryRepository()
        e1 = make_entry(price=100.0)
        e2 = make_entry(price=200.0)
        e3 = make_entry(price=300.0)

        await repo.add(e1)
        await repo.add(e2)
        await repo.add(e3)

        items = await repo.list()
        assert items == [e3, e2, e1]

    async def test_list_empty_returns_empty_list(self) -> None:
        repo = InMemoryHistoryRepository()
        assert await repo.list() == []

    async def test_count(self) -> None:
        repo = InMemoryHistoryRepository()
        await repo.add(make_entry())
        await repo.add(make_entry())
        assert await repo.count() == 2


class TestGet:
    async def test_get_existing_entry(self) -> None:
        repo = InMemoryHistoryRepository()
        entry = make_entry()
        await repo.add(entry)
        assert await repo.get(entry.id) is entry

    async def test_get_missing_returns_none(self) -> None:
        repo = InMemoryHistoryRepository()
        assert await repo.get("nonexistent-id") is None


class TestDelete:
    async def test_delete_existing_returns_true(self) -> None:
        repo = InMemoryHistoryRepository()
        entry = make_entry()
        await repo.add(entry)
        assert await repo.delete(entry.id) is True
        assert await repo.list() == []
        assert await repo.get(entry.id) is None

    async def test_delete_missing_returns_false(self) -> None:
        repo = InMemoryHistoryRepository()
        assert await repo.delete("nope") is False

    async def test_delete_middle_entry_preserves_others(self) -> None:
        repo = InMemoryHistoryRepository()
        e1, e2, e3 = make_entry(100), make_entry(200), make_entry(300)
        await repo.add(e1)
        await repo.add(e2)
        await repo.add(e3)

        assert await repo.delete(e2.id) is True
        items = await repo.list()
        assert items == [e3, e1]
        assert await repo.get(e2.id) is None
        assert await repo.get(e1.id) is e1
        assert await repo.get(e3.id) is e3


class TestClear:
    async def test_clear_returns_count(self) -> None:
        repo = InMemoryHistoryRepository()
        for _ in range(5):
            await repo.add(make_entry())
        assert await repo.clear() == 5
        assert await repo.list() == []

    async def test_clear_empty_returns_zero(self) -> None:
        repo = InMemoryHistoryRepository()
        assert await repo.clear() == 0


class TestFifoEviction:
    async def test_eviction_drops_oldest_when_capacity_reached(self) -> None:
        repo = InMemoryHistoryRepository(capacity=3)
        e1, e2, e3, e4 = (
            make_entry(100),
            make_entry(200),
            make_entry(300),
            make_entry(400),
        )
        await repo.add(e1)
        await repo.add(e2)
        await repo.add(e3)
        await repo.add(e4)  # should evict e1

        items = await repo.list()
        assert items == [e4, e3, e2]
        assert await repo.get(e1.id) is None  # evicted
        assert await repo.count() == 3

    async def test_eviction_keeps_index_in_sync(self) -> None:
        """After eviction, ``get(evicted_id)`` must return None."""
        repo = InMemoryHistoryRepository(capacity=2)
        e1 = make_entry(100)
        e2 = make_entry(200)
        e3 = make_entry(300)
        await repo.add(e1)
        await repo.add(e2)
        await repo.add(e3)

        assert await repo.get(e1.id) is None
        assert await repo.get(e2.id) is e2
        assert await repo.get(e3.id) is e3


class TestReplaceExistingId:
    async def test_add_same_id_replaces_in_place(self) -> None:
        """Adding an entry with an existing id updates it (defensive)."""
        repo = InMemoryHistoryRepository()
        entry = make_entry(100.0)
        await repo.add(entry)

        updated = HistoryEntry(
            id=entry.id,
            features=entry.features,
            predicted_price=999.0,
            created_at=entry.created_at,
        )
        await repo.add(updated)

        items = await repo.list()
        assert len(items) == 1
        assert items[0].predicted_price == 999.0
        assert await repo.get(entry.id) is updated


class TestConcurrency:
    async def test_concurrent_adds_do_not_lose_entries(self) -> None:
        """``asyncio.Lock`` must serialise concurrent adds."""
        repo = InMemoryHistoryRepository(capacity=100)
        entries = [make_entry(price=float(i)) for i in range(20)]

        # Schedule all adds concurrently — the lock should serialise them
        await asyncio.gather(*(repo.add(e) for e in entries))

        items = await repo.list()
        assert len(items) == 20
        # No entry should have been lost
        ids = {e.id for e in items}
        assert ids == {e.id for e in entries}

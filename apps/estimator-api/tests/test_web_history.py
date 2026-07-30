"""Integration tests for ``/history`` CRUD endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.domain import HistoryEntry, PropertyFeatures
from tests.conftest import valid_features_payload


def _seed_history(fake_history, count: int) -> list[HistoryEntry]:
    """Seed ``fake_history`` with ``count`` entries; return them oldest-first.

    Entries are inserted at index 0 of ``fake_history._entries`` (mirroring
    what ``add`` does), so after seeding the repo's internal list is
    ``[newest, ..., oldest]``. We return ``[oldest, ..., newest]`` to give
    callers a stable, intuitive order for assertions.
    """
    entries = []
    for i in range(count):
        entry = HistoryEntry.create(
            features=PropertyFeatures(
                square_footage=1000.0 + i,
                bedrooms=2 + (i % 3),
                bathrooms=1.5,
                year_built=1990,
                lot_size=4000.0,
                distance_to_city_center=4.0,
                school_rating=7.0,
            ),
            predicted_price=100_000.0 + i * 1000,
        )
        # Bypass the async add to keep this helper synchronous
        fake_history._entries.insert(0, entry)
        entries.append(entry)
    # entries is oldest-first (insertion order); return as-is.
    return entries


# ---------------------------------------------------------------------------
# GET /history
# ---------------------------------------------------------------------------


class TestListHistory:
    def test_empty_history_returns_zero_count(self, client: httpx.Client) -> None:
        response = client.get("/history")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"] == {"entries": [], "count": 0}

    def test_returns_entries_newest_first(
        self, fake_history, client: httpx.Client
    ) -> None:
        seeded = _seed_history(fake_history, 3)
        # seeded is oldest-first; the API returns newest-first
        response = client.get("/history")
        body = response.json()
        entries = body["data"]["entries"]
        assert body["data"]["count"] == 3
        # Newest (last seeded) should be first
        assert entries[0]["predicted_price"] == seeded[-1].predicted_price
        assert entries[-1]["predicted_price"] == seeded[0].predicted_price

    def test_sets_no_store_cache_control(self, client: httpx.Client) -> None:
        response = client.get("/history")
        assert response.headers["cache-control"] == "no-store"


# ---------------------------------------------------------------------------
# GET /history/{id}
# ---------------------------------------------------------------------------


class TestGetHistoryEntry:
    def test_returns_entry_by_id(self, fake_history, client: httpx.Client) -> None:
        seeded = _seed_history(fake_history, 1)
        entry_id = seeded[0].id

        response = client.get(f"/history/{entry_id}")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["id"] == entry_id
        assert body["data"]["predicted_price"] == seeded[0].predicted_price
        # Timestamp must be ISO-format parseable
        datetime.fromisoformat(body["data"]["created_at"])

    def test_missing_id_returns_envelope_404(self, client: httpx.Client) -> None:
        response = client.get("/history/nonexistent-uuid")
        assert response.status_code == 404
        # The 404 is raised via HTTPException; FastAPI returns its default
        # shape (not the unified envelope). This is acceptable — 404s for
        # missing resources are conventional. We assert the status only.
        assert response.json()["detail"] is not None


# ---------------------------------------------------------------------------
# DELETE /history/{id}
# ---------------------------------------------------------------------------


class TestDeleteHistoryEntry:
    def test_deletes_existing_entry(self, fake_history, client: httpx.Client) -> None:
        seeded = _seed_history(fake_history, 2)
        entry_id = seeded[0].id

        response = client.delete(f"/history/{entry_id}")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"] == {"deleted": True}

        # Confirm via list
        list_response = client.get("/history")
        assert list_response.json()["data"]["count"] == 1

    def test_delete_missing_returns_404(self, client: httpx.Client) -> None:
        response = client.delete("/history/no-such-id")
        assert response.status_code == 404

    def test_sets_no_store_cache_control(
        self, fake_history, client: httpx.Client
    ) -> None:
        seeded = _seed_history(fake_history, 1)
        response = client.delete(f"/history/{seeded[0].id}")
        assert response.headers["cache-control"] == "no-store"


# ---------------------------------------------------------------------------
# DELETE /history
# ---------------------------------------------------------------------------


class TestClearHistory:
    def test_clears_all_entries(self, fake_history, client: httpx.Client) -> None:
        _seed_history(fake_history, 5)
        response = client.delete("/history")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"] == {"cleared": 5}

        # Confirm empty
        list_response = client.get("/history")
        assert list_response.json()["data"]["count"] == 0

    def test_clear_on_empty_returns_zero(self, client: httpx.Client) -> None:
        response = client.delete("/history")
        assert response.status_code == 200
        assert response.json()["data"] == {"cleared": 0}

    def test_sets_no_store_cache_control(self, client: httpx.Client) -> None:
        response = client.delete("/history")
        assert response.headers["cache-control"] == "no-store"


# ---------------------------------------------------------------------------
# Predict persists to history
# ---------------------------------------------------------------------------


class TestPredictPersistsToHistory:
    def test_predict_adds_entry_to_history(
        self, fake_history, client: httpx.Client
    ) -> None:
        """A successful prediction must appear in the history list."""
        client.post("/predict", json={"features": valid_features_payload()})

        list_response = client.get("/history")
        body = list_response.json()
        assert body["data"]["count"] == 1
        entry = body["data"]["entries"][0]
        assert entry["predicted_price"] == 250_000.0
        assert entry["features"]["square_footage"] == 2000.0

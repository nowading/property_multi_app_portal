"use client";

import { useCallback, useEffect, useState } from "react";

import {
  HISTORY_MAX_ENTRIES,
  type HistoryEntry,
  type PredictionResult,
  type PropertyFeatures,
} from "@/lib/schemas/estimator";

/**
 * localStorage key for the estimator history array.
 *
 * Versioned (`v1`) so future schema changes can bump the version and
 * gracefully ignore older entries instead of crashing on parse.
 */
export const HISTORY_STORAGE_KEY = "portal:estimator:history:v1";

export interface UseEstimatorHistoryResult {
  entries: HistoryEntry[];
  /** Append a new entry; oldest is dropped when cap is exceeded. */
  addEntry: (features: PropertyFeatures, result: PredictionResult) => HistoryEntry;
  /** Remove a single entry by id. No-op if not found. */
  removeEntry: (id: string) => void;
  /** Clear all entries. */
  clearAll: () => void;
  /** Look up a single entry by id (useful for compare prefill). */
  getEntry: (id: string) => HistoryEntry | undefined;
}

/**
 * Persisted-history hook backed by `localStorage`.
 *
 * Behaviour:
 *  - SSR-safe: returns an empty array on the server; only reads storage
 *    inside `useEffect` so the first client render matches the server
 *    render (avoids hydration mismatches).
 *  - On mount, reads + parses the JSON array. If parsing fails or the
 *    payload is malformed, the storage is reset to `[]` so the user is
 *    never stuck with an unreadable history.
 *  - Subscribes to the window `storage` event so multiple open tabs of
 *    the portal stay in sync (e.g. estimate in tab A → list updates in
 *    tab B's `/estimator/history`).
 *  - FIFO cap at `HISTORY_MAX_ENTRIES` (default 50).
 *
 * The hook does NOT use the `useApi` cache — localStorage reads are
 * synchronous and cheap; wrapping them in `useApi` would add needless
 * async complexity.
 */
export function useEstimatorHistory(): UseEstimatorHistoryResult {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  // Initial read on mount (client only).
  useEffect(() => {
    setEntries(readFromStorage());

    function onStorage(event: StorageEvent) {
      if (event.key !== HISTORY_STORAGE_KEY) return;
      // Use event.newValue directly because browsers fire the event on
      // *other* tabs (whose localStorage has already been mutated), but
      // jsdom's StorageEvent does not auto-update the localStorage of
      // the dispatching window — reading from storage would return the
      // stale value.
      const parsed = parsePayload(event.newValue);
      setEntries(parsed ?? []);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addEntry = useCallback(
    (features: PropertyFeatures, result: PredictionResult): HistoryEntry => {
      const entry: HistoryEntry = {
        id: generateId(),
        timestamp: Date.now(),
        features,
        predicted_price: result.predicted_price,
      };
      setEntries((prev) => {
        const next = [entry, ...prev];
        if (next.length > HISTORY_MAX_ENTRIES) {
          next.length = HISTORY_MAX_ENTRIES;
        }
        writeToStorage(next);
        return next;
      });
      return entry;
    },
    []
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      writeToStorage(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
    try {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // ignore quota / privacy mode errors
    }
  }, []);

  const getEntry = useCallback(
    (id: string): HistoryEntry | undefined => entries.find((e) => e.id === id),
    [entries]
  );

  return { entries, addEntry, removeEntry, clearAll, getEntry };
}

// ---- storage helpers ---------------------------------------------------

function readFromStorage(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  const parsed = parsePayload(raw);
  // If the stored payload existed but was unparseable, wipe the key so
  // subsequent writes can succeed (otherwise the user is stuck with an
  // unreadable history). We only do this from the read path, not from
  // the storage-event path, because the event reflects another tab's
  // state and that tab is responsible for its own cleanup.
  if (parsed === null) {
    try {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // ignore
    }
    return [];
  }
  return parsed;
}

/**
 * Parse a raw JSON string (from localStorage or a StorageEvent's
 * `newValue`) into a validated `HistoryEntry[]`.
 *
 * Returns:
 *  - `null` when the payload existed but was unparseable (caller may wipe).
 *  - `[]` when the payload was missing, not an array, or contained only
 *    malformed entries.
 */
function parsePayload(raw: string | null): HistoryEntry[] | null {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return [];
  // Tolerate partial corruption: keep only entries that match the shape.
  return parsed.filter(isHistoryEntry);
}

function writeToStorage(next: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded or privacy mode — silently drop. The in-memory state
    // still updates so the current session works.
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.timestamp === "number" &&
    typeof v.predicted_price === "number" &&
    v.features !== null &&
    typeof v.features === "object"
  );
}

/**
 * Generate a unique-enough id without pulling in a uuid dependency.
 *
 * Format: `<timestamp-base36>-<random-base36>` — sortable by creation
 * time and collision-resistant for the small N (≤50) we keep.
 */
function generateId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${time}-${rand}`;
}

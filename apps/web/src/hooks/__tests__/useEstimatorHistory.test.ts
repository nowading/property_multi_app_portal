import "@testing-library/jest-dom";
import { act, renderHook, waitFor } from "@testing-library/react";

import { HISTORY_STORAGE_KEY, useEstimatorHistory } from "../useEstimatorHistory";
import {
  HISTORY_MAX_ENTRIES,
  type PredictionResult,
  type PropertyFeatures,
} from "@/lib/schemas/estimator";

const SAMPLE_FEATURES: PropertyFeatures = {
  square_footage: 2000,
  bedrooms: 3,
  bathrooms: 2.5,
  year_built: 1990,
  lot_size: 5000,
  distance_to_city_center: 5.5,
  school_rating: 8,
};

const SAMPLE_RESULT: PredictionResult = { predicted_price: 425000.5 };

function setStorage(value: unknown) {
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(value));
}

function readStorage<T = unknown>(): T | null {
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}

describe("useEstimatorHistory", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty when storage is empty", () => {
    const { result } = renderHook(() => useEstimatorHistory());
    expect(result.current.entries).toEqual([]);
  });

  it("loads existing entries from localStorage on mount", async () => {
    setStorage([
      {
        id: "abc",
        timestamp: 1_700_000_000_000,
        features: SAMPLE_FEATURES,
        predicted_price: 100000,
      },
    ]);

    const { result } = renderHook(() => useEstimatorHistory());
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].id).toBe("abc");
    expect(result.current.entries[0].predicted_price).toBe(100000);
  });

  it("addEntry prepends a new entry and persists to localStorage", () => {
    const { result } = renderHook(() => useEstimatorHistory());

    act(() => {
      result.current.addEntry(SAMPLE_FEATURES, SAMPLE_RESULT);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].predicted_price).toBe(425000.5);
    expect(result.current.entries[0].features).toEqual(SAMPLE_FEATURES);
    expect(typeof result.current.entries[0].id).toBe("string");
    expect(typeof result.current.entries[0].timestamp).toBe("number");

    const persisted = readStorage<unknown[]>();
    expect(persisted).toHaveLength(1);
  });

  it("addEntry prepends at index 0 so newest comes first", () => {
    const { result } = renderHook(() => useEstimatorHistory());

    act(() => {
      result.current.addEntry(SAMPLE_FEATURES, { predicted_price: 100 });
    });
    act(() => {
      result.current.addEntry(SAMPLE_FEATURES, { predicted_price: 200 });
    });

    expect(result.current.entries[0].predicted_price).toBe(200);
    expect(result.current.entries[1].predicted_price).toBe(100);
  });

  it("returns the created entry from addEntry", () => {
    const { result } = renderHook(() => useEstimatorHistory());
    let created;
    act(() => {
      created = result.current.addEntry(SAMPLE_FEATURES, SAMPLE_RESULT);
    });
    expect(created).toBeDefined();
    expect(created!.predicted_price).toBe(425000.5);
    expect(result.current.entries[0]).toBe(created);
  });

  it("removeEntry removes the matching id and persists", () => {
    const { result } = renderHook(() => useEstimatorHistory());

    let id1 = "";
    let id2 = "";
    act(() => {
      id1 = result.current.addEntry(SAMPLE_FEATURES, { predicted_price: 1 }).id;
      id2 = result.current.addEntry(SAMPLE_FEATURES, { predicted_price: 2 }).id;
    });
    expect(result.current.entries).toHaveLength(2);

    act(() => {
      result.current.removeEntry(id1);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe(id2);
    expect(readStorage<unknown[]>()).toHaveLength(1);
  });

  it("removeEntry is a no-op for an unknown id", () => {
    const { result } = renderHook(() => useEstimatorHistory());
    act(() => {
      result.current.addEntry(SAMPLE_FEATURES, SAMPLE_RESULT);
    });
    const before = result.current.entries;

    act(() => {
      result.current.removeEntry("does-not-exist");
    });

    expect(result.current.entries).toEqual(before);
  });

  it("clearAll empties state and removes the storage key", () => {
    const { result } = renderHook(() => useEstimatorHistory());
    act(() => {
      result.current.addEntry(SAMPLE_FEATURES, SAMPLE_RESULT);
    });
    expect(result.current.entries).toHaveLength(1);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.entries).toEqual([]);
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
  });

  it("getEntry returns the matching entry by id", () => {
    const { result } = renderHook(() => useEstimatorHistory());
    let id = "";
    act(() => {
      id = result.current.addEntry(SAMPLE_FEATURES, SAMPLE_RESULT).id;
    });
    expect(result.current.getEntry(id)).toBeDefined();
    expect(result.current.getEntry("missing")).toBeUndefined();
  });

  it("enforces the FIFO cap at HISTORY_MAX_ENTRIES", () => {
    const { result } = renderHook(() => useEstimatorHistory());

    act(() => {
      for (let i = 0; i < HISTORY_MAX_ENTRIES + 5; i++) {
        result.current.addEntry(SAMPLE_FEATURES, {
          predicted_price: i,
        });
      }
    });

    expect(result.current.entries).toHaveLength(HISTORY_MAX_ENTRIES);
    // The newest (predicted_price = HISTORY_MAX_ENTRIES + 4) should be first.
    expect(result.current.entries[0].predicted_price).toBe(
      HISTORY_MAX_ENTRIES + 4
    );
    // The oldest surviving entry should be the one at index 5 of the original
    // add order — i.e. predicted_price = 5.
    expect(result.current.entries[HISTORY_MAX_ENTRIES - 1].predicted_price).toBe(5);

    const persisted = readStorage<unknown[]>();
    expect(persisted).toHaveLength(HISTORY_MAX_ENTRIES);
  });

  it("drops malformed entries instead of crashing", async () => {
    setStorage([
      { id: "good", timestamp: 1, features: SAMPLE_FEATURES, predicted_price: 1 },
      { id: "bad-no-features", timestamp: 2, predicted_price: 2 },
      { timestamp: 3 }, // missing required fields
      "not-an-object",
      null,
    ]);

    const { result } = renderHook(() => useEstimatorHistory());
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].id).toBe("good");
  });

  it("resets storage when JSON is unparseable", async () => {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, "{not valid json");
    const { result } = renderHook(() => useEstimatorHistory());
    await waitFor(() => expect(result.current.entries).toEqual([]));
    // The bad payload should have been wiped.
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
  });

  it("reflects storage events from other tabs", async () => {
    const { result } = renderHook(() => useEstimatorHistory());
    expect(result.current.entries).toEqual([]);

    const externalPayload = [
      {
        id: "from-other-tab",
        timestamp: 1_700_000_000_000,
        features: SAMPLE_FEATURES,
        predicted_price: 999,
      },
    ];

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: HISTORY_STORAGE_KEY,
          newValue: JSON.stringify(externalPayload),
        })
      );
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].id).toBe("from-other-tab");
  });

  it("ignores storage events for other keys", async () => {
    const { result } = renderHook(() => useEstimatorHistory());
    act(() => {
      result.current.addEntry(SAMPLE_FEATURES, SAMPLE_RESULT);
    });
    expect(result.current.entries).toHaveLength(1);
    const before = result.current.entries;

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "some-other-key",
          newValue: "[]",
        })
      );
    });

    expect(result.current.entries).toEqual(before);
  });
});

import "@testing-library/jest-dom";
import { act, renderHook, waitFor } from "@testing-library/react";

import { invalidate, useApi } from "../useApi";

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, error: null }),
  } as Response;
}

describe("useApi", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    invalidate();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("starts in loading state when a URL is provided", () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse("x")) as unknown as typeof fetch;
    const { result } = renderHook(() => useApi<string>("https://example.com/a"));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("starts idle when URL is null", () => {
    const { result } = renderHook(() => useApi<string>(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("fetches and exposes data on success", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ count: 7 })) as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useApi<{ count: number }>("https://example.com/stats")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ count: 7 });
    expect(result.current.error).toBeNull();
  });

  it("exposes ApiError on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        data: null,
        error: { code: "ML_DOWN", message: "ML service unavailable" },
      }),
    } as Response) as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useApi<string>("https://example.com/predict")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.code).toBe("ML_DOWN");
    expect(result.current.data).toBeNull();
  });

  it("returns cached data on second mount without calling fetch again", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse("cached-value")) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result: first } = renderHook(() =>
      useApi<string>("https://example.com/cached")
    );
    await waitFor(() => expect(first.current.isLoading).toBe(false));
    expect(first.current.data).toBe("cached-value");

    // Unmount and re-render with the same URL — cache should hit.
    const { result: second } = renderHook(() =>
      useApi<string>("https://example.com/cached")
    );
    await waitFor(() => expect(second.current.isLoading).toBe(false));
    expect(second.current.data).toBe("cached-value");

    // fetch should only have been called once (first mount).
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("invalidate(url) forces a refetch on next mount", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse("first"))
      .mockResolvedValueOnce(jsonResponse("second")) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result: first } = renderHook(() =>
      useApi<string>("https://example.com/invalidate")
    );
    await waitFor(() => expect(first.current.isLoading).toBe(false));
    expect(first.current.data).toBe("first");

    invalidate("https://example.com/invalidate");

    const { result: second } = renderHook(() =>
      useApi<string>("https://example.com/invalidate")
    );
    await waitFor(() => expect(second.current.isLoading).toBe(false));
    expect(second.current.data).toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refetch() bypasses the cache and re-fetches", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse("a"))
      .mockResolvedValueOnce(jsonResponse("b")) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useApi<string>("https://example.com/refetch")
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe("a");

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.data).toBe("b"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refetches when the URL changes", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse("first-url"))
      .mockResolvedValueOnce(jsonResponse("second-url")) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      ({ url }) => useApi<string>(url),
      { initialProps: { url: "https://example.com/one" } }
    );

    await waitFor(() => expect(result.current.data).toBe("first-url"));

    rerender({ url: "https://example.com/two" });

    await waitFor(() => expect(result.current.data).toBe("second-url"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

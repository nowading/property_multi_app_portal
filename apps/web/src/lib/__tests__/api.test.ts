import { ApiError, apiFetch, type ApiEnvelope } from "../api";

/**
 * Helper: build a Response-like object that `apiFetch` can consume.
 */
function jsonResponse<T>(body: ApiEnvelope<T>, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  } as Response;
}

describe("apiFetch", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns unwrapped data when envelope.success is true", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { id: 1 }, error: null })
    ) as unknown as typeof fetch;

    const result = await apiFetch<{ id: number }>("https://example.com/api");
    expect(result).toEqual({ id: 1 });
  });

  it("throws ApiError with the envelope's code and message when success=false", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        success: false,
        data: null,
        error: { code: "ML_SERVICE_TIMEOUT", message: "ML timed out" },
      })
    ) as unknown as typeof fetch;

    await expect(apiFetch("https://example.com/api")).rejects.toMatchObject({
      name: "ApiError",
      code: "ML_SERVICE_TIMEOUT",
      message: "ML timed out",
    });
  });

  it("throws ApiError with UNKNOWN_ERROR when envelope has no error field", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ success: false, data: null, error: null })
    ) as unknown as typeof fetch;

    await expect(apiFetch("https://example.com/api")).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
    });
  });

  it("throws ApiError with HTTP_ERROR on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ success: false, data: null, error: null }),
    } as Response) as unknown as typeof fetch;

    await expect(apiFetch("https://example.com/api")).rejects.toMatchObject({
      code: "HTTP_ERROR",
      status: 500,
    });
  });

  it("throws ApiError with REQUEST_TIMEOUT when fetch aborts", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    global.fetch = jest.fn().mockRejectedValue(abortError) as unknown as typeof fetch;

    await expect(
      apiFetch("https://example.com/api", { timeoutMs: 50 })
    ).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
  });

  it("throws ApiError with NETWORK_ERROR on generic fetch failure", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("connection refused")) as unknown as typeof fetch;

    await expect(apiFetch("https://example.com/api")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "connection refused",
    });
  });

  it("throws ApiError with PARSE_ERROR when response is not JSON", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as Response) as unknown as typeof fetch;

    await expect(apiFetch("https://example.com/api")).rejects.toMatchObject({
      code: "PARSE_ERROR",
    });
  });

  it("throws ApiError with NULL_DATA when success=true but data is null", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: null, error: null })
    ) as unknown as typeof fetch;

    await expect(apiFetch("https://example.com/api")).rejects.toMatchObject({
      code: "NULL_DATA",
    });
  });

  it("passes the next option through to fetch (RSC caching)", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: 42, error: null })
    ) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiFetch("https://example.com/api", {
      next: { revalidate: 300 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({
        next: { revalidate: 300 },
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("ApiError is instanceof Error and carries code/status", () => {
    const err = new ApiError("CODE", "msg", 503);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("CODE");
    expect(err.message).toBe("msg");
    expect(err.status).toBe(503);
    expect(err.name).toBe("ApiError");
  });
});

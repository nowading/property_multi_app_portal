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
    } as unknown as Response) as unknown as typeof fetch;

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

/**
 * Phase B — service-to-service auth.
 *
 * `apiFetch` must attach the `x-internal-token` header to every server-side
 * call so the backend's inbound auth middleware accepts the request.
 * Browser calls must NOT carry the header (browser cannot reach internal
 * services after Phase A; emitting the secret client-side would also be a
 * leak risk).
 */
describe("apiFetch x-internal-token header (Phase B server-side auth)", () => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  const originalToken = process.env.INTERNAL_SERVICE_TOKEN;

  afterEach(() => {
    global.fetch = originalFetch;
    global.window = originalWindow;
    process.env.INTERNAL_SERVICE_TOKEN = originalToken;
  });

  it("attaches x-internal-token header on the server when INTERNAL_SERVICE_TOKEN is set", async () => {
    // Simulate server runtime (no `window`) and a known token in env. We use
    // jest.isolateModules so the module re-reads `process.env` and re-binds
    // its `typeof window === "undefined"` check against the deleted global.
    // @ts-expect-error — test runtime manipulation
    delete (global as { window?: unknown }).window;
    process.env.INTERNAL_SERVICE_TOKEN = "my-server-token";

    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: true, data: { ok: 1 }, error: null })
      ) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    await new Promise<void>((resolve, reject) => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { apiFetch: freshApiFetch } = require("../api") as typeof import("../api");
        freshApiFetch("https://example.com/api").then(
          () => {
            try {
              expect(fetchMock).toHaveBeenCalledTimes(1);
              const init = fetchMock.mock.calls[0][1] as RequestInit;
              const headers = init.headers as Record<string, string>;
              expect(headers["x-internal-token"]).toBe("my-server-token");
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          reject
        );
      });
    });
  });

  it("does NOT attach x-internal-token header when running in the browser (window defined)", async () => {
    // jsdom (the default test env) defines `window`; the runtime check
    // `typeof window === "undefined"` in apiFetch must therefore be false
    // and the header must be omitted even when INTERNAL_SERVICE_TOKEN is
    // set.
    process.env.INTERNAL_SERVICE_TOKEN = "should-not-leak";
    // window is already defined in jsdom — no need to restore.

    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: true, data: { ok: 1 }, error: null })
      ) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    // Uses the top-level imported apiFetch (loaded in jsdom where window
    // is defined). The INTERNAL_SERVICE_TOKEN constant captured at module
    // load is non-empty, but the runtime `isServer` guard keeps the header
    // out of the call.
    await apiFetch("https://example.com/api");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["x-internal-token"]).toBeUndefined();
  });
});

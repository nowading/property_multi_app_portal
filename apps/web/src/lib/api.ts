/**
 * Typed API client for the Property Portal.
 *
 * - Parses the unified backend envelope { success, data, error }
 *   (see PROJECT_PLAN.md §3) and unwraps `data` on success.
 * - Throws `ApiError` (typed) when the envelope reports failure, when the
 *   network fails, or when the request times out.
 * - Supports Next.js RSC fetch caching via the `next` option
 *   (e.g. `{ next: { revalidate: 300 } }`).
 *
 * Used by both React Server Components (direct call) and the `useApi` hook
 * (client side).
 */

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
}

/**
 * Typed error thrown by `apiFetch` for any non-success outcome:
 * envelope `success=false`, timeout, network failure, HTTP error, or
 * JSON parse failure.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export interface ApiFetchOptions extends RequestInit {
  /** Abort the request after this many ms. Default 10s. */
  timeoutMs?: number;
  /** Next.js fetch caching options (RSC only). */
  next?: { revalidate?: number; tags?: string[] };
}

/** RSC revalidate durations (seconds) per §3.1 of PROJECT_PLAN.md. */
export const RSC_REVALIDATE = {
  MODEL_INFO: 300,
  DEFAULT_STATS: 300,
} as const;

/**
 * Fetch a JSON resource that follows the unified envelope and return the
 * unwrapped `data`. Throws `ApiError` on any failure.
 */
export async function apiFetch<T>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { timeoutMs = 10_000, ...rest } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...rest, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        "REQUEST_TIMEOUT",
        `Request to ${url} timed out after ${timeoutMs}ms`
      );
    }
    throw new ApiError(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "Network request failed"
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ApiError(
      "HTTP_ERROR",
      `HTTP ${response.status} ${response.statusText} from ${url}`,
      response.status
    );
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      "PARSE_ERROR",
      `Failed to parse JSON response from ${url}`
    );
  }

  if (!body.success) {
    const err: ApiErrorPayload = body.error ?? {
      code: "UNKNOWN_ERROR",
      message: "Unknown error",
    };
    throw new ApiError(err.code, err.message, response.status);
  }

  if (body.data === null || body.data === undefined) {
    throw new ApiError(
      "NULL_DATA",
      `Response data is null for ${url}`,
      response.status
    );
  }

  return body.data;
}

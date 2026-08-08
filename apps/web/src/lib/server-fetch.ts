/**
 * Server-side fetch helpers for RSC (React Server Components).
 *
 * Provides typed fetch with envelope unwrapping and health-check helpers.
 * Uses native `fetch` (not `apiFetch`) because `apiFetch` is designed for
 * mixed client/server use with browser-friendly fallbacks, while RSC needs
 * direct control over Next.js `next` caching options and envelope parsing.
 *
 * When `INTERNAL_SERVICE_TOKEN` is configured in the server environment,
 * outbound requests automatically include the `x-internal-token` header so
 * the backend's inbound auth middleware (Phase B) accepts them. This file
 * is RSC-only — it should never be imported from a Client Component.
 */

import { INTERNAL_SERVICE_TOKEN } from "./api-config";
import type { ApiEnvelope } from "./api";

const DEFAULT_TIMEOUT = 10_000;

export interface ServerFetchOptions extends RequestInit {
  /** Abort the request after this many ms. Default 10s. */
  timeoutMs?: number;
  /** Next.js fetch caching options (RSC only). */
  next?: { revalidate?: number; tags?: string[] };
}

/**
 * Merge `x-internal-token` into the given headers when the server-side
 * `INTERNAL_SERVICE_TOKEN` is set. Never modifies headers on the client
 * (this file is RSC-only, but the guard is defensive).
 */
function withInternalToken(
  headers: HeadersInit | undefined
): HeadersInit | undefined {
  if (!INTERNAL_SERVICE_TOKEN) return headers;
  const merged: Record<string, string> = {};
  if (headers) {
    if (Array.isArray(headers)) {
      for (const [k, v] of headers) merged[k] = v;
    } else if (headers instanceof Headers) {
      headers.forEach((v, k) => {
        merged[k] = v;
      });
    } else {
      Object.assign(merged, headers as Record<string, string>);
    }
  }
  merged["x-internal-token"] = INTERNAL_SERVICE_TOKEN;
  return merged;
}

/**
 * Fetch a JSON resource that follows the unified envelope and return the
 * unwrapped `data`. Throws on any failure.
 */
export async function serverFetch<T>(
  url: string,
  options: ServerFetchOptions = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, next, headers, ...rest } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: withInternalToken(headers),
      next,
      signal: controller.signal,
    } as RequestInit & { next?: { revalidate?: number; tags?: string[] } });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw new Error(
      err instanceof Error ? err.message : "Network request failed"
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} from ${url}`
    );
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Failed to parse JSON response from ${url}`);
  }

  if (!body.success) {
    const errMsg = body.error?.message ?? "Unknown error";
    throw new Error(errMsg);
  }

  if (body.data === null || body.data === undefined) {
    throw new Error(`Response data is null for ${url}`);
  }

  return body.data;
}

export interface HealthStatus {
  status: "healthy" | "unhealthy" | "down";
  details?: string;
}

/**
 * Check the health endpoint of a service.
 * Returns "healthy", "unhealthy", or "down" without throwing.
 */
export async function checkHealth(
  url: string,
  options: ServerFetchOptions = {}
): Promise<HealthStatus> {
  try {
    const response = await fetch(url, {
      headers: withInternalToken(options.headers),
      next: { revalidate: 30 },
      ...options,
    } as RequestInit & { next?: { revalidate?: number } });

    if (!response.ok) {
      return { status: "unhealthy", details: `HTTP ${response.status}` };
    }

    const body = (await response.json().catch(() => null)) as
      | { status?: string }
      | null;

    if (body && typeof body === "object" && "status" in body) {
      const s = (body as { status: string }).status;
      if (s === "UP" || s === "healthy") {
        return { status: "healthy" };
      }
      return { status: "unhealthy", details: `Status: ${s}` };
    }

    return { status: "healthy" };
  } catch {
    return { status: "down" };
  }
}
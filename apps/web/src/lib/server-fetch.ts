/**
 * Server-side fetch helpers for RSC (React Server Components).
 *
 * Provides typed fetch with envelope unwrapping and health-check helpers.
 * Uses native `fetch` (not `apiFetch`) because `apiFetch` is designed for
 * mixed client/server use with browser-friendly fallbacks, while RSC needs
 * direct control over Next.js `next` caching options and envelope parsing.
 */

import type { ApiEnvelope } from "./api";

const DEFAULT_TIMEOUT = 10_000;

export interface ServerFetchOptions extends RequestInit {
  /** Abort the request after this many ms. Default 10s. */
  timeoutMs?: number;
  /** Next.js fetch caching options (RSC only). */
  next?: { revalidate?: number; tags?: string[] };
}

/**
 * Fetch a JSON resource that follows the unified envelope and return the
 * unwrapped `data`. Throws on any failure.
 */
export async function serverFetch<T>(
  url: string,
  options: ServerFetchOptions = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, next, ...rest } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
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
"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api";

/**
 * Module-level in-memory cache for GET responses (per §3.1 of PROJECT_PLAN.md).
 *
 * - TTL 60s by default.
 * - Keyed by URL.
 * - `invalidate(key)` evicts a single entry; `invalidate()` clears all.
 *
 * This cache reduces HTTP calls on the client (filter toggles, nav back/forth).
 * It composes with — never duplicates — the backend Caffeine cache, which
 * reduces CPU.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60_000;

/** Evict a single URL from the cache, or all entries when no key is given. */
export function invalidate(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/** Test-only helper to inspect cache size. */
export function __cacheSize(): number {
  return cache.size;
}

export interface UseApiState<T> {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
}

export interface UseApiResult<T> extends UseApiState<T> {
  /** Force a refetch bypassing the cache. */
  refetch: () => void;
}

/**
 * Fetch a GET resource following the unified envelope.
 *
 * - Pass `null` as the URL to skip fetching (useful for conditional fetches).
 * - On mount and whenever `url` changes, checks the module cache first.
 *   On cache hit (not expired), returns cached data synchronously.
 * - On cache miss, calls `apiFetch` and stores the result with TTL.
 * - `refetch()` bypasses the cache and re-fetches.
 */
export function useApi<T>(
  url: string | null,
  options?: { ttlMs?: number }
): UseApiResult<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: url !== null,
  });

  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;

  const fetchData = useCallback(
    async (bypassCache: boolean) => {
      if (url === null) {
        setState({ data: null, error: null, isLoading: false });
        return;
      }

      if (!bypassCache) {
        const cached = cache.get(url);
        if (cached && cached.expiresAt > Date.now()) {
          setState({ data: cached.data as T, error: null, isLoading: false });
          return;
        }
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const data = await apiFetch<T>(url);
        cache.set(url, { data, expiresAt: Date.now() + ttl });
        setState({ data, error: null, isLoading: false });
      } catch (err) {
        const error =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN_ERROR", String(err));
        setState({ data: null, error, isLoading: false });
      }
    },
    [url, ttl]
  );

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return { ...state, refetch };
}

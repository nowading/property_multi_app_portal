"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError, apiFetch, type ApiFetchOptions } from "@/lib/api"

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
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL_MS = 60_000

/** Evict a single URL from the cache, or all entries when no key is given. */
export function invalidate(key?: string): void {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}

/** Test-only helper to inspect cache size. */
export function __cacheSize(): number {
  return cache.size
}

export interface UseApiState<T> {
  data: T | null
  error: ApiError | null
  isLoading: boolean
}

export interface UseApiResult<T> extends UseApiState<T> {
  /** Force a refetch bypassing the cache. */
  refetch: () => void
}

/** Options for GET requests (cached). */
export interface UseApiGetOptions {
  ttlMs?: number
}

/** Options for POST requests (uncached). */
export interface UseApiPostOptions {
  method: "POST"
  body: string | object
}

/** Check if the given options object is a POST options variant. */
function isPostOptions(
  options: UseApiGetOptions | UseApiPostOptions | undefined
): options is UseApiPostOptions {
  return options !== undefined && "method" in options && options.method === "POST"
}

/**
 * Fetch a GET resource following the unified envelope.
 *
 * - Pass `null` as the URL to skip fetching (useful for conditional fetches).
 * - On mount and whenever `url` changes, checks the module cache first.
 *   On cache hit (not expired), returns cached data synchronously.
 * - On cache miss, calls `apiFetch` and stores the result with TTL.
 * - `refetch()` bypasses the cache and re-fetches.
 *
 * POST requests (when `options.method === 'POST'`):
 * - Are never cached — the body is included in the fetch call.
 * - `refetch()` re-sends the same POST with the same body.
 */
export function useApi<T>(
  url: string | null,
  options?: UseApiGetOptions | UseApiPostOptions
): UseApiResult<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: url !== null,
  })

  const isPost = isPostOptions(options)
  const ttl = !isPost ? (options as UseApiGetOptions)?.ttlMs ?? DEFAULT_TTL_MS : 0

  const fetchData = useCallback(
    async (bypassCache: boolean) => {
      if (url === null) {
        setState({ data: null, error: null, isLoading: false })
        return
      }

      if (!isPost && !bypassCache) {
        const cached = cache.get(url)
        if (cached && cached.expiresAt > Date.now()) {
          setState({ data: cached.data as T, error: null, isLoading: false })
          return
        }
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const fetchOptions: ApiFetchOptions = {}

        if (isPost) {
          const postOpts = options as UseApiPostOptions
          fetchOptions.method = "POST"
          fetchOptions.headers = { "Content-Type": "application/json" }
          fetchOptions.body =
            typeof postOpts.body === "string"
              ? postOpts.body
              : JSON.stringify(postOpts.body)
        }

        const data = await apiFetch<T>(url, fetchOptions)

        if (!isPost) {
          cache.set(url, { data, expiresAt: Date.now() + ttl })
        }

        setState({ data, error: null, isLoading: false })
      } catch (err) {
        const error =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN_ERROR", String(err))
        setState({ data: null, error, isLoading: false })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, isPost, ttl, options]
  )

  useEffect(() => {
    fetchData(false)
  }, [fetchData])

  const refetch = useCallback(() => {
    fetchData(true)
  }, [fetchData])

  return { ...state, refetch }
}
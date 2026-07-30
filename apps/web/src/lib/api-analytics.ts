/**
 * Analytics API helper functions.
 *
 * Provides typed wrappers around `apiFetch` for the analytics endpoints
 * (stats, dataset, what-if) and URL builders that convert filter objects
 * into query-string parameters.
 */

import { apiFetch } from "@/lib/api"
import {
  ANALYTICS_API_URL,
  ANALYTICS_API_PATHS,
} from "@/lib/api-config"
import type {
  MarketStats,
  DatasetResponse,
  WhatIfFeatures,
  WhatIfResult,
  StatsFilters,
} from "@/lib/schemas/analytics"

/**
 * Build a query string from an optional StatsFilters object.
 * Only defined (non-undefined) numeric fields are included.
 */
function buildFilterParams(filters: StatsFilters | undefined): string {
  if (!filters) return ""

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

/**
 * Build the full URL for GET /api/stats with optional filter query params.
 */
export function buildStatsUrl(
  filters: StatsFilters | undefined,
  baseUrl: string = ANALYTICS_API_URL
): string {
  return `${baseUrl}${ANALYTICS_API_PATHS.STATS}${buildFilterParams(filters)}`
}

/**
 * Build the full URL for GET /api/dataset with pagination and optional filters.
 */
export function buildDatasetUrl(
  page: number,
  pageSize: number,
  filters: StatsFilters | undefined,
  baseUrl: string = ANALYTICS_API_URL
): string {
  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("page_size", String(pageSize))

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) {
        params.set(key, String(value))
      }
    }
  }

  return `${baseUrl}${ANALYTICS_API_PATHS.DATASET}?${params.toString()}`
}

/**
 * Fetch aggregate market statistics (GET /api/stats).
 */
export function fetchStats(
  filters?: StatsFilters,
  signal?: AbortSignal
): Promise<MarketStats> {
  const url = buildStatsUrl(filters)
  return apiFetch<MarketStats>(url, { signal })
}

/**
 * Fetch a paginated dataset (GET /api/dataset).
 */
export function fetchDataset(
  page: number,
  pageSize: number,
  filters?: StatsFilters,
  signal?: AbortSignal
): Promise<DatasetResponse> {
  const url = buildDatasetUrl(page, pageSize, filters)
  return apiFetch<DatasetResponse>(url, { signal })
}

/**
 * Submit a what-if prediction (POST /api/what-if).
 */
export function postWhatIf(
  features: WhatIfFeatures,
  signal?: AbortSignal
): Promise<WhatIfResult> {
  const url = `${ANALYTICS_API_URL}${ANALYTICS_API_PATHS.WHAT_IF}`
  return apiFetch<WhatIfResult>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(features),
    signal,
  })
}
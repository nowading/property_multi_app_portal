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
 * Mapping from frontend snake_case filter keys to backend camelCase query params.
 */
const FILTER_KEY_TO_PARAM: Record<string, string> = {
  bedrooms_min: "bedroomsMin",
  bedrooms_max: "bedroomsMax",
  year_built_min: "yearBuiltMin",
  year_built_max: "yearBuiltMax",
  distance_max: "distanceMax",
  school_rating_min: "schoolRatingMin",
  school_rating_max: "schoolRatingMax",
  price_min: "priceMin",
  price_max: "priceMax",
}

const PARAM_TO_FILTER_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(FILTER_KEY_TO_PARAM).map(([k, v]) => [v, k])
)

/**
 * Build a query string from an optional StatsFilters object.
 * Only defined (non-undefined) numeric fields are included.
 * Converts snake_case filter keys to camelCase for the Java backend.
 */
function buildFilterParams(filters: StatsFilters | undefined): string {
  if (!filters) return ""

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      const paramName = FILTER_KEY_TO_PARAM[key] || key
      params.set(paramName, String(value))
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
  params.set("pageSize", String(pageSize))

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) {
        const paramName = FILTER_KEY_TO_PARAM[key] || key
        params.set(paramName, String(value))
      }
    }
  }

  return `${baseUrl}${ANALYTICS_API_PATHS.DATASET}?${params.toString()}`
}

/**
 * Parse filter query params from a URLSearchParams object.
 * Converts camelCase backend params back to snake_case for frontend state.
 */
export function parseFilterParams(searchParams: URLSearchParams): StatsFilters {
  const filters: StatsFilters = {}
  for (const [paramName, filterKey] of Object.entries(PARAM_TO_FILTER_KEY)) {
    const val = searchParams.get(paramName)
    if (val !== null) {
      const num = Number(val)
      if (!Number.isNaN(num)) {
        ;(filters as Record<string, number>)[filterKey] = num
      }
    }
  }
  return filters
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
/**
 * API base URLs for both server-side (RSC) and client-side components.
 *
 * - Server-side (RSC): prefers non-public env var (e.g. Docker network URL
 *   like `http://estimator-api:8001`), falls back to NEXT_PUBLIC_ then default.
 * - Client-side: uses NEXT_PUBLIC_ env var (inlined at build time), falls
 *   back to default. Browser cannot resolve Docker internal hostnames.
 *
 * Mirrors `.env.example` § Web section.
 */

function resolveApiUrl(
  serverKey: string,
  publicKey: string,
  defaultValue: string
): string {
  if (typeof window === "undefined" && process.env[serverKey]) {
    return process.env[serverKey] as string;
  }
  return process.env[publicKey] || defaultValue;
}

export const ESTIMATOR_API_URL = resolveApiUrl(
  "ESTIMATOR_API_URL",
  "NEXT_PUBLIC_ESTIMATOR_API_URL",
  "http://localhost:8001"
);

export const ANALYTICS_API_URL = resolveApiUrl(
  "ANALYTICS_API_URL",
  "NEXT_PUBLIC_ANALYTICS_API_URL",
  "http://localhost:8002"
);

/**
 * Shared secret for service-to-service auth (Phase B).
 *
 * Server-side only — must NOT be exposed to the browser (no `NEXT_PUBLIC_`
 * prefix). Read by server-side fetch helpers and attached to outbound
 * requests as the `x-internal-token` header so backends' inbound auth
 * middleware accepts the request. Trimmed to defend against accidental
 * whitespace from `.env` files; defaults to empty string when unset.
 */
export const INTERNAL_SERVICE_TOKEN = (
  process.env.INTERNAL_SERVICE_TOKEN ?? ""
).trim();

export const ANALYTICS_API_PATHS = {
  STATS: "/api/stats",
  DATASET: "/api/dataset",
  WHAT_IF: "/api/what-if",
  MODEL_INFO: "/api/model/info",
} as const

export const ESTIMATOR_API_PATHS = {
  PREDICT: "/predict",
  PREDICT_BATCH: "/predict-batch",
  HISTORY: "/history",
  MODEL_INFO: "/model-info",
  HEALTHZ: "/healthz",
} as const

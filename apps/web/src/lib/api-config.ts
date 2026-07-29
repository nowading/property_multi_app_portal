/**
 * Public API base URLs for client-side components.
 *
 * Next.js requires the `NEXT_PUBLIC_` prefix to expose env vars to the
 * browser bundle. Server components can read the non-prefixed variants
 * directly from `process.env` when needed.
 *
 * Mirrors `.env.example` § Web section.
 */
export const ESTIMATOR_API_URL =
  process.env.NEXT_PUBLIC_ESTIMATOR_API_URL || "http://localhost:8001";

export const ANALYTICS_API_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_API_URL || "http://localhost:8002";

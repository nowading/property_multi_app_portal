import { Suspense } from "react";

import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export const metadata = {
  title: "Market Analysis Dashboard",
};

/**
 * Analytics page (RSC shell).
 *
 * Delegates all interactivity (chart rendering, filter state, data fetching)
 * to the <AnalyticsDashboard> client component. Wraps it in Suspense
 * because useSearchParams requires a boundary. Uses mock data until the
 * Spring Boot backend is available (Phase 5).
 */
export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">
          Property Market Analysis
        </h1>
        <p className="text-sm text-slate-600">
          Explore aggregate statistics, price distributions, and trends across
          the housing dataset. Use the filters below to drill down into
          specific market segments.
        </p>
      </div>

      <Suspense fallback={<p className="text-slate-500">Loading dashboard…</p>}>
        <AnalyticsDashboard />
      </Suspense>
    </div>
  );
}

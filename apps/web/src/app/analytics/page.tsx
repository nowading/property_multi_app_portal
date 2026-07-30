import { Suspense } from "react";

import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { serverFetch } from "@/lib/server-fetch";
import type {
  DatasetResponse,
  MarketStats,
} from "@/lib/schemas/analytics";

export const metadata = {
  title: "Market Analysis Dashboard",
};

const ANALYTICS_API_URL =
  process.env.ANALYTICS_API_URL || "http://localhost:8002";

export default async function AnalyticsPage() {
  let initialStats: MarketStats | null = null;
  let initialDataset: DatasetResponse | null = null;

  try {
    [initialStats, initialDataset] = await Promise.all([
      serverFetch<MarketStats>(`${ANALYTICS_API_URL}/api/stats`, {
        next: { revalidate: 300 },
      }).catch(() => null),
      serverFetch<DatasetResponse>(
        `${ANALYTICS_API_URL}/api/dataset?page=1&page_size=50`,
        { next: { revalidate: 60 } }
      ).catch(() => null),
    ]);
  } catch {
    initialStats = null;
    initialDataset = null;
  }

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
        <AnalyticsDashboard
          initialStats={initialStats}
          initialDataset={initialDataset}
        />
      </Suspense>
    </div>
  );
}
import { Suspense } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

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
        `${ANALYTICS_API_URL}/api/dataset?page=1&pageSize=50`,
        { next: { revalidate: 60 } }
      ).catch(() => null),
    ]);
  } catch {
    initialStats = null;
    initialDataset = null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
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
        <Link
          href="/analytics/what-if"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-primary-600 bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          What-If Analysis
        </Link>
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
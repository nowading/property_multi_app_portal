"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { BedroomBoxPlot } from "./BedroomBoxPlot";
import { DataTable } from "./DataTable";
import { ExportPanel } from "./ExportPanel";
import { FilterPanel } from "./FilterPanel";
import { KpiCard } from "./KpiCard";
import { PriceHistogram } from "./PriceHistogram";
import { PriceScatter } from "./PriceScatter";
import { fetchStats, fetchDataset } from "@/lib/api-analytics";
import { getErrorMessage } from "@/lib/error-messages";
import { ApiError } from "@/lib/api";
import {
  DEFAULT_FILTERS,
  formatNumber,
  formatPrice,
  type DatasetResponse,
  type MarketStats,
  type PropertyRow,
  type StatsFilters,
} from "@/lib/schemas/analytics";

const FILTER_PARAM_KEYS: (keyof StatsFilters)[] = [
  "bedrooms_min",
  "bedrooms_max",
  "year_built_min",
  "year_built_max",
  "distance_max",
  "school_rating_min",
];

const FILTER_KEY_TO_PARAM: Record<string, string> = {
  bedrooms_min: "bedroomsMin",
  bedrooms_max: "bedroomsMax",
  year_built_min: "yearBuiltMin",
  year_built_max: "yearBuiltMax",
  distance_max: "distanceMax",
  school_rating_min: "schoolRatingMin",
};

const PARAM_TO_FILTER_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(FILTER_KEY_TO_PARAM).map(([k, v]) => [v, k])
);

function parseFiltersFromUrl(searchParams: URLSearchParams): StatsFilters {
  const filters: StatsFilters = {};
  for (const [paramName, filterKey] of Object.entries(PARAM_TO_FILTER_KEY)) {
    const val = searchParams.get(paramName);
    if (val !== null) {
      const num = Number(val);
      if (!Number.isNaN(num)) {
        (filters as Record<string, number>)[filterKey] = num;
      }
    }
  }
  return filters;
}

function buildUrlFromFilters(filters: StatsFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_PARAM_KEYS) {
    const val = filters[key];
    if (val !== undefined) {
      const paramName = FILTER_KEY_TO_PARAM[key] || key;
      params.set(paramName, String(val));
    }
  }
  return params;
}

export interface AnalyticsDashboardProps {
  initialStats?: MarketStats | null;
  initialDataset?: DatasetResponse | null;
  initialFilters?: StatsFilters;
}

export function AnalyticsDashboard({
  initialStats,
  initialDataset,
  initialFilters,
}: AnalyticsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<StatsFilters>(() => {
    // Prefer RSC-provided initialFilters to avoid hydration mismatch
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      return initialFilters;
    }
    // Fallback: parse from URL searchParams (only if initialFilters is empty)
    if (typeof searchParams !== "undefined") {
      const parsed = parseFiltersFromUrl(searchParams);
      if (Object.keys(parsed).length > 0) return parsed;
    }
    return DEFAULT_FILTERS;
  });

  const isFirstUrlUpdate = useRef(true);

  const [stats, setStats] = useState<MarketStats | null>(initialStats ?? null);
  const [datasetRows, setDatasetRows] = useState<PropertyRow[]>(
    initialDataset?.rows ?? []
  );
  const [datasetTotal, setDatasetTotal] = useState(
    initialDataset?.total ?? 0
  );
  const [isLoading, setIsLoading] = useState(!initialStats);
  const [error, setError] = useState<string | null>(null);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  const loadData = useCallback(
    async (currentFilters: StatsFilters, signal: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      setDatasetError(null);

      try {
        const [statsData, datasetData] = await Promise.all([
          fetchStats(currentFilters, signal),
          fetchDataset(1, 50, currentFilters, signal),
        ]);
        setStats(statsData);
        setDatasetRows(datasetData.rows);
        setDatasetTotal(datasetData.total);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(getErrorMessage(err.code));
        } else {
          setError(getErrorMessage("UNKNOWN_ERROR"));
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  // ------------------------------------------------------------------
  // Request deduplication strategy
  // ------------------------------------------------------------------
  // Two sources can trigger data fetching:
  //   A) RSC re-render (router.replace → page.tsx serverFetch)
  //      → new initialStats / initialDataset / initialFilters arrive as props
  //   B) Client-side useEffect on [filters] change
  //
  // We rely on RSC as the primary data source:
  //   1. When filters change, we update the URL (router.replace) which
  //      triggers RSC to re-fetch.
  //   2. The client effect waits for RSC: if rscFiltersKey matches
  //      current filters AND RSC data exists → skip client fetch.
  //   3. If filters differ from rscFiltersKey, RSC hasn't responded yet.
  //      We return immediately and wait for the rscFiltersKey dep to
  //      trigger a re-run when RSC delivers.
  //   4. If filters match rscFiltersKey but RSC data is null (failure),
  //      we fall back to a debounced client-side fetch.
  //   5. lastFetchedKeyRef prevents duplicate fetches from Strict Mode
  //      double-mount or repeated effect invocations.
  // ------------------------------------------------------------------

  /** Stable key of the latest RSC-provided filters (updated every render). */
  const rscFiltersKey = useMemo(
    () => JSON.stringify(initialFilters ?? {}),
    [initialFilters]
  );

  /** Dedup guard: the last filters key for which we initiated a fetch. */
  const lastFetchedKeyRef = useRef<string | null>(null);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Sync state from RSC props when they change (e.g. after router.replace).
  // This is the primary data path — RSC drives the UI.
  useEffect(() => {
    if (initialStats) {
      setStats(initialStats);
      setIsLoading(false);
      setError(null);
    }
    if (initialDataset) {
      setDatasetRows(initialDataset.rows);
      setDatasetTotal(initialDataset.total);
      setDatasetError(null);
    }
  }, [initialStats, initialDataset]);

  useEffect(() => {
    const currentFiltersKey = JSON.stringify(filtersRef.current);

    // Case 1: RSC has already provided data for these exact filters.
    if (
      currentFiltersKey === rscFiltersKey &&
      (initialStats || initialDataset)
    ) {
      return;
    }

    // Case 2: filters changed but RSC hasn't responded yet.
    // Wait for rscFiltersKey to catch up via a future re-render.
    if (currentFiltersKey !== rscFiltersKey) {
      return;
    }

    // Case 3: filters match RSC's initialFilters, but RSC data is
    // null/missing (RSC fetch failed, or initial load without pre-fetch).
    // Fall back to debounced client-side fetch.

    // Dedup: skip if we already initiated a fetch for this exact key.
    if (currentFiltersKey === lastFetchedKeyRef.current) {
      return;
    }
    lastFetchedKeyRef.current = currentFiltersKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      loadData(filtersRef.current, controller.signal);
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [filters, initialStats, initialDataset, rscFiltersKey, loadData]);

  useEffect(() => {
    if (isFirstUrlUpdate.current) {
      isFirstUrlUpdate.current = false;
      return;
    }
    if (typeof router === "undefined") return;

    const params = buildUrlFromFilters(filters);
    const paramStr = params.toString();
    const newUrl = paramStr ? `?${paramStr}` : window.location.pathname;

    const timeout = setTimeout(() => {
      router.replace(newUrl, { scroll: false });
    }, 300);

    return () => clearTimeout(timeout);
  }, [filters, router]);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleRetry = useCallback(() => {
    const controller = new AbortController();
    loadData(filters, controller.signal);
  }, [filters, loadData]);

  const displayStats = stats;
  const hasData = !!displayStats && !isLoading && !error;

  return (
    <div className="flex flex-col gap-6">
      <FilterPanel filters={filters} onChange={setFilters} onReset={handleReset} />

      {error && !isLoading && (
        <div
          role="alert"
          className="rounded-lg border border-rose-300 bg-rose-50 p-4"
        >
          <p className="text-sm text-rose-700">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 rounded border border-rose-300 bg-white px-3 py-1 text-sm text-rose-700 hover:bg-rose-50"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && (
        <div
          role="status"
          className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-500"
        >
          Loading market data...
        </div>
      )}

      {hasData && displayStats && (
        <ExportPanel stats={displayStats} dataset={datasetRows} />
      )}

      <section
        aria-label="Market summary statistics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {!displayStats || isLoading ? (
          <>
            <KpiCard
              label="Total Listings"
              value="..."
              description="Loading..."
            />
            <KpiCard
              label="Average Price"
              value="..."
              description="Loading..."
            />
            <KpiCard
              label="Median Price"
              value="..."
              description="Loading..."
            />
            <KpiCard
              label="Price Range"
              value="..."
              description="Loading..."
            />
          </>
        ) : (
          <>
            <KpiCard
              label="Total Listings"
              value={formatNumber(displayStats.kpis.count)}
              description="Properties in dataset"
            />
            <KpiCard
              label="Average Price"
              value={formatPrice(displayStats.kpis.avg_price)}
              trend="up"
              trendValue={`${formatPrice(displayStats.kpis.avg_price_per_sq_ft)}/sqft`}
              description="Price per square foot"
            />
            <KpiCard
              label="Median Price"
              value={formatPrice(displayStats.kpis.median_price)}
              description="Midpoint of all prices"
            />
            <KpiCard
              label="Price Range"
              value={`${formatPrice(displayStats.kpis.min_price)} – ${formatPrice(displayStats.kpis.max_price)}`}
              description={`Std dev: ${formatPrice(displayStats.kpis.std_dev_price)}`}
            />
          </>
        )}
      </section>

      <section
        aria-label="Price distribution and scatter analysis"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        {!displayStats?.price_histogram || isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
            Loading chart...
          </div>
        ) : (
          <PriceHistogram data={displayStats.price_histogram} />
        )}
        {!displayStats?.price_vs_sqft || isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
            Loading chart...
          </div>
        ) : (
          <PriceScatter data={displayStats.price_vs_sqft} />
        )}
      </section>

      <section aria-label="Price range by bedroom count">
        {!displayStats?.box_plot_by_bedrooms || isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
            Loading chart...
          </div>
        ) : (
          <BedroomBoxPlot data={displayStats.box_plot_by_bedrooms} />
        )}
      </section>

      <section aria-label="Property dataset table">
        {datasetError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50 p-4"
          >
            <p className="text-sm text-rose-700">{datasetError}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-2 rounded border border-rose-300 bg-white px-3 py-1 text-sm text-rose-700 hover:bg-rose-50"
            >
              Retry
            </button>
          </div>
        ) : (
          <DataTable data={datasetRows} total={datasetTotal} />
        )}
      </section>
    </div>
  );
}

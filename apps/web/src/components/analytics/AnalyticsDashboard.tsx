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
import { generateMarketStats } from "@/lib/mock/analytics";
import { generatePropertyDataset } from "@/lib/mock/dataset";
import {
  DEFAULT_FILTERS,
  formatNumber,
  formatPrice,
  type MarketStats,
  type StatsFilters,
} from "@/lib/schemas/analytics";

const MOCK_SEED = 42;

const FILTER_PARAM_KEYS: (keyof StatsFilters)[] = [
  "bedrooms_min",
  "bedrooms_max",
  "year_built_min",
  "year_built_max",
  "distance_max",
  "school_rating_min",
];

function parseFiltersFromUrl(searchParams: URLSearchParams): StatsFilters {
  const filters: StatsFilters = {};
  for (const key of FILTER_PARAM_KEYS) {
    const val = searchParams.get(key);
    if (val !== null) {
      const num = Number(val);
      if (!Number.isNaN(num)) {
        filters[key] = num;
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
      params.set(key, String(val));
    }
  }
  return params;
}

export interface AnalyticsDashboardProps {
  initialStats?: MarketStats | null;
  initialFilters?: StatsFilters;
}

/**
 * Analytics dashboard client component.
 *
 * Displays KPI summary cards, a filter panel, and three chart visualisations.
 * Filters are synced to URL search params so they are bookmarkable and
 * survive page refresh. URL updates are debounced (300ms) to avoid
 * excessive history entries during slider drag.
 *
 * Currently uses mock data (matching the Spring Boot API shape). Will switch
 * to real API calls in Phase 5.
 */
export function AnalyticsDashboard({
  initialStats,
  initialFilters,
}: AnalyticsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<StatsFilters>(() => {
    if (initialFilters) return initialFilters;
    if (typeof searchParams !== "undefined") {
      return parseFiltersFromUrl(searchParams);
    }
    return DEFAULT_FILTERS;
  });

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
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

  const stats = useMemo(
    () => initialStats ?? generateMarketStats(MOCK_SEED, filters),
    [initialStats, filters]
  );

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const { kpis, price_histogram, price_vs_sqft, box_plot_by_bedrooms } = stats;

  const dataset = useMemo(
    () => generatePropertyDataset(MOCK_SEED, filters),
    [filters]
  );

  return (
    <div className="flex flex-col gap-6">
      <FilterPanel filters={filters} onChange={setFilters} onReset={handleReset} />

      {/* Export controls */}
      <ExportPanel stats={stats} dataset={dataset} />

      {/* KPI cards row */}
      <section
        aria-label="Market summary statistics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          label="Total Listings"
          value={formatNumber(kpis.count)}
          description="Properties in dataset"
        />
        <KpiCard
          label="Average Price"
          value={formatPrice(kpis.avg_price)}
          trend="up"
          trendValue={`${formatPrice(kpis.avg_price_per_sqft)}/sqft`}
          description="Price per square foot"
        />
        <KpiCard
          label="Median Price"
          value={formatPrice(kpis.median_price)}
          description="Midpoint of all prices"
        />
        <KpiCard
          label="Price Range"
          value={`${formatPrice(kpis.min_price)} – ${formatPrice(kpis.max_price)}`}
          description={`Std dev: ${formatPrice(kpis.std_dev_price)}`}
        />
      </section>

      {/* Charts row 1: histogram + scatter */}
      <section
        aria-label="Price distribution and scatter analysis"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <PriceHistogram data={price_histogram} />
        <PriceScatter data={price_vs_sqft} />
      </section>

      {/* Charts row 2: box plot */}
      <section aria-label="Price range by bedroom count">
        <BedroomBoxPlot data={box_plot_by_bedrooms} />
      </section>

      {/* Data table */}
      <section aria-label="Property dataset table">
        <DataTable data={dataset} />
      </section>
    </div>
  );
}

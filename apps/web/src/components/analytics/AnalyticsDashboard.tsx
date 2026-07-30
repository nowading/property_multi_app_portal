"use client";

import { useMemo } from "react";

import { BedroomBoxPlot } from "./BedroomBoxPlot";
import { KpiCard } from "./KpiCard";
import { PriceHistogram } from "./PriceHistogram";
import { PriceScatter } from "./PriceScatter";
import { generateMarketStats } from "@/lib/mock/analytics";
import {
  formatNumber,
  formatPrice,
  type MarketStats,
} from "@/lib/schemas/analytics";

export interface AnalyticsDashboardProps {
  /**
   * Optional pre-fetched stats. When provided, the dashboard uses them
   * directly (RSC pattern). When null, generates mock data on the client.
   */
  initialStats?: MarketStats | null;
}

/**
 * Analytics dashboard client component.
 *
 * Displays KPI summary cards and three chart visualisations:
 * 1. Price histogram — distribution of property prices
 * 2. Price vs. square footage scatter plot
 * 3. Box plot — price range by bedroom count
 *
 * Currently uses mock data (matching the Spring Boot API shape). Will switch
 * to real API calls in Phase 5.
 */
export function AnalyticsDashboard({ initialStats }: AnalyticsDashboardProps) {
  const stats = useMemo(
    () => initialStats ?? generateMarketStats(),
    [initialStats]
  );

  const { kpis, price_histogram, price_vs_sqft, box_plot_by_bedrooms } = stats;

  return (
    <div className="flex flex-col gap-6">
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
    </div>
  );
}

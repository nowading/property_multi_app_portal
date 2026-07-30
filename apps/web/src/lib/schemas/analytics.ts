/**
 * Type definitions and Zod schemas for the Property Market Analysis app.
 *
 * These types define the contract between the Next.js frontend and the
 * Spring Boot analytics API (Phase 5). The frontend is developed against
 * these types with mock data; the backend will implement endpoints that
 * return data matching this shape.
 *
 * API endpoints (Spring Boot, port 8002):
 *   GET  /api/stats            — aggregate statistics + chart data
 *   GET  /api/stats?filters=…  — filtered statistics
 *   GET  /api/dataset          — paginated dataset rows
 *   POST /api/what-if          — what-if prediction
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Dataset row (mirrors housing.csv columns)
// ---------------------------------------------------------------------------

export const PropertyRowSchema = z.object({
  id: z.number(),
  square_footage: z.number(),
  bedrooms: z.number(),
  bathrooms: z.number(),
  year_built: z.number(),
  lot_size: z.number(),
  distance_to_city_center: z.number(),
  school_rating: z.number(),
  price: z.number(),
});

export type PropertyRow = z.infer<typeof PropertyRowSchema>;

// ---------------------------------------------------------------------------
// KPI summary
// ---------------------------------------------------------------------------

export const KpiSummarySchema = z.object({
  count: z.number(),
  avg_price: z.number(),
  median_price: z.number(),
  min_price: z.number(),
  max_price: z.number(),
  std_dev_price: z.number(),
  avg_square_footage: z.number(),
  avg_price_per_sq_ft: z.number(),
});

export type KpiSummary = z.infer<typeof KpiSummarySchema>;

// ---------------------------------------------------------------------------
// Chart data shapes
// ---------------------------------------------------------------------------

/** Histogram bin: a price range and the count of properties in that range. */
export const HistogramBinSchema = z.object({
  range: z.string(),
  count: z.number(),
  range_start: z.number(),
  range_end: z.number(),
});

export type HistogramBin = z.infer<typeof HistogramBinSchema>;

/** Scatter plot point: square footage vs price, coloured by bedroom count. */
export const ScatterPointSchema = z.object({
  square_footage: z.number(),
  price: z.number(),
  bedrooms: z.number(),
});

export type ScatterPoint = z.infer<typeof ScatterPointSchema>;

/** Box plot statistics for one bedroom-count group. */
export const BoxPlotGroupSchema = z.object({
  bedrooms: z.number(),
  min: z.number(),
  q1: z.number(),
  median: z.number(),
  q3: z.number(),
  max: z.number(),
  count: z.number(),
});

export type BoxPlotGroup = z.infer<typeof BoxPlotGroupSchema>;

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export const StatsFiltersSchema = z.object({
  bedrooms_min: z.number().optional(),
  bedrooms_max: z.number().optional(),
  year_built_min: z.number().optional(),
  year_built_max: z.number().optional(),
  distance_max: z.number().optional(),
  school_rating_min: z.number().optional(),
  school_rating_max: z.number().optional(),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
});

export type StatsFilters = z.infer<typeof StatsFiltersSchema>;

// ---------------------------------------------------------------------------
// Aggregate stats response (GET /api/stats)
// ---------------------------------------------------------------------------

export const MarketStatsSchema = z.object({
  kpis: KpiSummarySchema,
  price_histogram: z.array(HistogramBinSchema),
  price_vs_sqft: z.array(ScatterPointSchema),
  box_plot_by_bedrooms: z.array(BoxPlotGroupSchema),
  filters_applied: StatsFiltersSchema,
});

export type MarketStats = z.infer<typeof MarketStatsSchema>;

// ---------------------------------------------------------------------------
// Dataset response (GET /api/dataset)
// ---------------------------------------------------------------------------

export const DatasetResponseSchema = z.object({
  rows: z.array(PropertyRowSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
});

export type DatasetResponse = z.infer<typeof DatasetResponseSchema>;

// ---------------------------------------------------------------------------
// What-if analysis (POST /api/what-if)
// ---------------------------------------------------------------------------

export const WhatIfFeaturesSchema = z.object({
  square_footage: z.number(),
  bedrooms: z.number(),
  bathrooms: z.number(),
  year_built: z.number(),
  lot_size: z.number(),
  distance_to_city_center: z.number(),
  school_rating: z.number(),
});

export type WhatIfFeatures = z.infer<typeof WhatIfFeaturesSchema>;

export const WhatIfResultSchema = z.object({
  predicted_price: z.number(),
  baseline_price: z.number(),
  delta: z.number(),
  delta_percent: z.number(),
  features: WhatIfFeaturesSchema,
});

export type WhatIfResult = z.infer<typeof WhatIfResultSchema>;

// ---------------------------------------------------------------------------
// Feature metadata (for sliders, filters, table headers)
// ---------------------------------------------------------------------------

export interface FeatureMeta {
  name: keyof WhatIfFeatures;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
}

export const WHAT_IF_FEATURES: FeatureMeta[] = [
  {
    name: "square_footage",
    label: "Square Footage",
    min: 500,
    max: 5000,
    step: 50,
    unit: "sq ft",
    description: "Total living area",
  },
  {
    name: "bedrooms",
    label: "Bedrooms",
    min: 1,
    max: 6,
    step: 1,
    unit: "",
    description: "Number of bedrooms",
  },
  {
    name: "bathrooms",
    label: "Bathrooms",
    min: 1,
    max: 4,
    step: 0.5,
    unit: "",
    description: "Number of bathrooms",
  },
  {
    name: "year_built",
    label: "Year Built",
    min: 1950,
    max: 2025,
    step: 1,
    unit: "",
    description: "Year the property was built",
  },
  {
    name: "lot_size",
    label: "Lot Size",
    min: 1000,
    max: 15000,
    step: 100,
    unit: "sq ft",
    description: "Lot size in square feet",
  },
  {
    name: "distance_to_city_center",
    label: "Distance to City",
    min: 0,
    max: 30,
    step: 0.5,
    unit: "mi",
    description: "Distance to city center in miles",
  },
  {
    name: "school_rating",
    label: "School Rating",
    min: 1,
    max: 10,
    step: 0.5,
    unit: "/10",
    description: "Local school rating",
  },
];

/** Default feature values for the what-if tool (median property). */
export const DEFAULT_WHAT_IF_FEATURES: WhatIfFeatures = {
  square_footage: 2000,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1995,
  lot_size: 6000,
  distance_to_city_center: 5,
  school_rating: 7,
};

// ---------------------------------------------------------------------------
// Filter metadata (for the filters component)
// ---------------------------------------------------------------------------

export interface FilterMeta {
  name: keyof StatsFilters;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export const FILTER_DEFINITIONS: FilterMeta[] = [
  {
    name: "bedrooms_min",
    label: "Min Bedrooms",
    min: 1,
    max: 6,
    step: 1,
    unit: "",
  },
  {
    name: "bedrooms_max",
    label: "Max Bedrooms",
    min: 1,
    max: 6,
    step: 1,
    unit: "",
  },
  {
    name: "year_built_min",
    label: "Min Year Built",
    min: 1950,
    max: 2025,
    step: 1,
    unit: "",
  },
  {
    name: "year_built_max",
    label: "Max Year Built",
    min: 1950,
    max: 2025,
    step: 1,
    unit: "",
  },
  {
    name: "distance_max",
    label: "Max Distance to City",
    min: 0,
    max: 30,
    step: 1,
    unit: "mi",
  },
  {
    name: "school_rating_min",
    label: "Min School Rating",
    min: 1,
    max: 10,
    step: 0.5,
    unit: "/10",
  },
];

export const DEFAULT_FILTERS: StatsFilters = {};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a price as USD currency (e.g. $245,620). */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a price with cents (e.g. $245,620.50). */
export function formatPriceDetailed(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a number with thousands separators (e.g. 2,000). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** Format a percentage (e.g. 12.5%). */
export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/**
 * Mock data generator for the Property Market Analysis dashboard.
 *
 * Generates realistic housing market statistics that mirror the shape
 * returned by the Spring Boot analytics API (Phase 5). Uses a seeded
 * pseudo-random generator so the dashboard is deterministic across renders
 * (no flicker on re-renders).
 *
 * This module will be replaced by real API calls once the analytics backend
 * is available. The types are defined in `lib/schemas/analytics.ts`.
 */

import type {
  BoxPlotGroup,
  HistogramBin,
  KpiSummary,
  MarketStats,
  ScatterPoint,
  StatsFilters,
} from "@/lib/schemas/analytics";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — deterministic, no dependencies
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

const DEFAULT_SEED = 42;

/** Generate a normal-ish random value (Box-Muller transform). */
function gauss(rand: () => number, mean: number, stddev: number): number {
  const u1 = rand() || 1e-10;
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z;
}

/** Generate the full market stats dataset for a given seed and filters. */
export function generateMarketStats(
  seed: number = DEFAULT_SEED,
  filters: StatsFilters = {}
): MarketStats {
  const rand = mulberry32(seed);

  // Determine the effective filter bounds
  const bedroomsMin = filters.bedrooms_min ?? 1;
  const bedroomsMax = filters.bedrooms_max ?? 6;
  const yearMin = filters.year_built_min ?? 1950;
  const yearMax = filters.year_built_max ?? 2025;
  const distanceMax = filters.distance_max ?? 30;
  const schoolMin = filters.school_rating_min ?? 1;
  const schoolMax = filters.school_rating_max ?? 10;
  const priceMin = filters.price_min ?? 50_000;
  const priceMax = filters.price_max ?? 2_000_000;

  const count = 500; // simulated dataset size
  const prices: number[] = [];
  const sqftValues: number[] = [];
  const bedroomsValues: number[] = [];

  for (let i = 0; i < count; i++) {
    const sqft = Math.max(
      500,
      Math.min(5000, Math.round(gauss(rand, 2000, 700)))
    );
    const bedrooms = Math.max(
      bedroomsMin,
      Math.min(bedroomsMax, Math.round(gauss(rand, 3, 1.2)))
    );
    const yearBuilt = Math.max(
      yearMin,
      Math.min(yearMax, Math.round(gauss(rand, 1995, 15)))
    );
    const distance = Math.max(0, Math.min(distanceMax, gauss(rand, 8, 5)));
    const schoolRating = Math.max(
      schoolMin,
      Math.min(schoolMax, gauss(rand, 6.5, 1.8))
    );
    const lotSize = Math.max(1000, Math.min(15000, gauss(rand, 6000, 2500)));

    // Base price formula (simplified model)
    const basePrice =
      sqft * 150 +
      bedrooms * 15000 -
      distance * 8000 +
      schoolRating * 12000 +
      (yearBuilt - 1950) * 800 +
      lotSize * 15;
    const noise = gauss(rand, 0, 25000);
    const price = Math.max(
      priceMin,
      Math.min(priceMax, Math.round(basePrice + noise))
    );

    prices.push(price);
    sqftValues.push(sqft);
    bedroomsValues.push(bedrooms);
  }

  // -----------------------------------------------------------------------
  // KPIs
  // -----------------------------------------------------------------------
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
  const minPrice = sortedPrices[0];
  const maxPrice = sortedPrices[sortedPrices.length - 1];
  const variance =
    prices.reduce((sum, p) => sum + (p - avgPrice) ** 2, 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const avgSqft = sqftValues.reduce((a, b) => a + b, 0) / sqftValues.length;
  const avgPricePerSqft = avgPrice / avgSqft;

  const kpis: KpiSummary = {
    count,
    avg_price: Math.round(avgPrice),
    median_price: Math.round(medianPrice),
    min_price: Math.round(minPrice),
    max_price: Math.round(maxPrice),
    std_dev_price: Math.round(stdDev),
    avg_square_footage: Math.round(avgSqft),
    avg_price_per_sq_ft: Math.round(avgPricePerSqft),
  };

  // -----------------------------------------------------------------------
  // Price histogram (10 bins)
  // -----------------------------------------------------------------------
  const binCount = 10;
  const binWidth = (maxPrice - minPrice) / binCount;
  const histogramBins: HistogramBin[] = [];

  for (let i = 0; i < binCount; i++) {
    const rangeStart = minPrice + i * binWidth;
    const rangeEnd = rangeStart + binWidth;
    const count = prices.filter(
      (p) => p >= rangeStart && (i === binCount - 1 ? p <= rangeEnd : p < rangeEnd)
    ).length;
    histogramBins.push({
      range: `$${Math.round(rangeStart / 1000)}k–$${Math.round(rangeEnd / 1000)}k`,
      count,
      range_start: Math.round(rangeStart),
      range_end: Math.round(rangeEnd),
    });
  }

  // -----------------------------------------------------------------------
  // Price vs sqft scatter (sampled for performance)
  // -----------------------------------------------------------------------
  const scatterPoints: ScatterPoint[] = [];
  const sampleStep = Math.max(1, Math.floor(count / 100));
  for (let i = 0; i < count; i += sampleStep) {
    scatterPoints.push({
      square_footage: sqftValues[i],
      price: prices[i],
      bedrooms: bedroomsValues[i],
    });
  }

  // -----------------------------------------------------------------------
  // Box plot by bedrooms
  // -----------------------------------------------------------------------
  const boxPlotGroups: BoxPlotGroup[] = [];
  for (let beds = bedroomsMin; beds <= bedroomsMax; beds++) {
    const groupPrices = prices.filter((_, i) => bedroomsValues[i] === beds);
    if (groupPrices.length === 0) continue;
    const sorted = [...groupPrices].sort((a, b) => a - b);
    const n = sorted.length;
    boxPlotGroups.push({
      bedrooms: beds,
      min: sorted[0],
      q1: sorted[Math.floor(n * 0.25)],
      median: sorted[Math.floor(n * 0.5)],
      q3: sorted[Math.floor(n * 0.75)],
      max: sorted[n - 1],
      count: n,
    });
  }

  return {
    kpis,
    price_histogram: histogramBins,
    price_vs_sqft: scatterPoints,
    box_plot_by_bedrooms: boxPlotGroups,
    filters_applied: filters,
  };
}

/**
 * Mock dataset generator for the Property Market Analysis data table.
 *
 * Generates deterministic property rows matching the PropertyRow schema.
 * Uses a seeded PRNG so the dataset is stable across renders.
 */

import type { PropertyRow, StatsFilters } from "@/lib/schemas/analytics";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number, mean: number, stddev: number): number {
  const u1 = rand() || 1e-10;
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z;
}

export function generatePropertyDataset(
  seed: number = 42,
  filters: StatsFilters = {},
  count: number = 500
): PropertyRow[] {
  const rand = mulberry32(seed);

  const bedroomsMin = filters.bedrooms_min ?? 1;
  const bedroomsMax = filters.bedrooms_max ?? 6;
  const yearMin = filters.year_built_min ?? 1950;
  const yearMax = filters.year_built_max ?? 2025;
  const distanceMax = filters.distance_max ?? 30;
  const schoolMin = filters.school_rating_min ?? 1;
  const schoolMax = filters.school_rating_max ?? 10;
  const priceMin = filters.price_min ?? 50_000;
  const priceMax = filters.price_max ?? 2_000_000;

  const rows: PropertyRow[] = [];

  for (let i = 0; i < count; i++) {
    const sqft = Math.max(500, Math.min(5000, Math.round(gauss(rand, 2000, 700))));
    const bedrooms = Math.max(
      bedroomsMin,
      Math.min(bedroomsMax, Math.round(gauss(rand, 3, 1.2)))
    );
    const bathrooms = Math.max(1, Math.min(4, Math.round(gauss(rand, 2, 0.8))));
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

    rows.push({
      id: i + 1,
      square_footage: sqft,
      bedrooms,
      bathrooms,
      year_built: yearBuilt,
      lot_size: lotSize,
      distance_to_city_center: Math.round(distance * 10) / 10,
      school_rating: Math.round(schoolRating * 10) / 10,
      price,
    });
  }

  return rows;
}
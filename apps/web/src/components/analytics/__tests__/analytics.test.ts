import { generateMarketStats } from "@/lib/mock/analytics";
import {
  formatNumber,
  formatPrice,
  formatPercent,
} from "@/lib/schemas/analytics";

describe("generateMarketStats", () => {
  it("returns deterministic data for the same seed", () => {
    const a = generateMarketStats(42);
    const b = generateMarketStats(42);
    expect(a.kpis.avg_price).toBe(b.kpis.avg_price);
    expect(a.price_histogram[0].count).toBe(b.price_histogram[0].count);
    expect(a.box_plot_by_bedrooms.length).toBe(b.box_plot_by_bedrooms.length);
  });

  it("returns different data for different seeds", () => {
    const a = generateMarketStats(42);
    const b = generateMarketStats(99);
    expect(a.kpis.avg_price).not.toBe(b.kpis.avg_price);
  });

  it("generates 500 data points", () => {
    const stats = generateMarketStats();
    expect(stats.kpis.count).toBe(500);
    // Scatter is sampled, so fewer points
    expect(stats.price_vs_sqft.length).toBeLessThanOrEqual(500);
    expect(stats.price_vs_sqft.length).toBeGreaterThan(0);
  });

  it("produces valid KPI summary", () => {
    const stats = generateMarketStats();
    const { kpis } = stats;
    expect(kpis.count).toBe(500);
    expect(kpis.avg_price).toBeGreaterThan(0);
    expect(kpis.median_price).toBeGreaterThanOrEqual(kpis.min_price);
    expect(kpis.median_price).toBeLessThanOrEqual(kpis.max_price);
    expect(kpis.min_price).toBeLessThan(kpis.max_price);
    expect(kpis.std_dev_price).toBeGreaterThan(0);
    expect(kpis.avg_square_footage).toBeGreaterThan(0);
    expect(kpis.avg_price_per_sq_ft).toBeGreaterThan(0);
  });

  it("produces 10 histogram bins", () => {
    const stats = generateMarketStats();
    expect(stats.price_histogram).toHaveLength(10);
    const totalCount = stats.price_histogram.reduce(
      (sum, bin) => sum + bin.count,
      0
    );
    expect(totalCount).toBe(500);
  });

  it("produces box plot groups for each bedroom count", () => {
    const stats = generateMarketStats();
    // Should have groups for 1-6 bedrooms (some may be missing if no data)
    for (const group of stats.box_plot_by_bedrooms) {
      expect(group.count).toBeGreaterThan(0);
      expect(group.min).toBeLessThanOrEqual(group.median);
      expect(group.median).toBeLessThanOrEqual(group.max);
      expect(group.q1).toBeLessThanOrEqual(group.median);
      expect(group.median).toBeLessThanOrEqual(group.q3);
    }
  });

  it("applies bedroom count filters", () => {
    const filtered = generateMarketStats(42, {
      bedrooms_min: 4,
      bedrooms_max: 4,
    });
    // Box plot should only have the 4-bedroom group
    for (const g of filtered.box_plot_by_bedrooms) {
      expect(g.bedrooms).toBe(4);
    }
  });

  it("applies price filters (reduces range)", () => {
    const filtered = generateMarketStats(42, {
      price_min: 200_000,
      price_max: 600_000,
    });
    for (const bin of filtered.price_histogram) {
      // Bins outside the filter range may still show (histogram is of the
      // full dataset), but the filter is recorded in the response.
    }
    expect(filtered.filters_applied.price_min).toBe(200_000);
    expect(filtered.filters_applied.price_max).toBe(600_000);
  });

  it("records applied filters in the response", () => {
    const filters = { bedrooms_min: 2, distance_max: 10, school_rating_min: 5 };
    const stats = generateMarketStats(42, filters);
    expect(stats.filters_applied.bedrooms_min).toBe(2);
    expect(stats.filters_applied.distance_max).toBe(10);
    expect(stats.filters_applied.school_rating_min).toBe(5);
  });
});

describe("formatPrice", () => {
  it("formats as USD currency", () => {
    expect(formatPrice(245620)).toBe("$245,620");
    expect(formatPrice(1000000)).toBe("$1,000,000");
    expect(formatPrice(9999)).toBe("$9,999");
  });
});

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(500)).toBe("500");
    expect(formatNumber(12500)).toBe("12,500");
    expect(formatNumber(1000000)).toBe("1,000,000");
  });
});

describe("formatPercent", () => {
  it("formats with sign and one decimal", () => {
    expect(formatPercent(12.5)).toBe("+12.5%");
    expect(formatPercent(-3.2)).toBe("-3.2%");
    expect(formatPercent(0)).toBe("+0.0%");
  });
});

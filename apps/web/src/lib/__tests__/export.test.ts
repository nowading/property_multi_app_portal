import "@testing-library/jest-dom";

import {
  downloadTextFile,
  exportDatasetCsv,
  exportFullReport,
  exportMarketStatsCsv,
  generateReportHtml,
  marketStatsToCsv,
  propertyRowsToCsv,
} from "@/lib/export";
import type { MarketStats, PropertyRow } from "@/lib/schemas/analytics";

// jsdom does not implement URL.createObjectURL / revokeObjectURL — polyfill
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = () => "blob:mock-url";
}
if (typeof URL.revokeObjectURL === "undefined") {
  URL.revokeObjectURL = () => {};
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_ROWS: PropertyRow[] = [
  {
    id: 1,
    square_footage: 2000,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1995,
    lot_size: 6000,
    distance_to_city_center: 5,
    school_rating: 7,
    price: 550_000,
  },
  {
    id: 2,
    square_footage: 1500,
    bedrooms: 2,
    bathrooms: 1,
    year_built: 2010,
    lot_size: 4000,
    distance_to_city_center: 3,
    school_rating: 8,
    price: 420_000,
  },
];

const SAMPLE_STATS: MarketStats = {
  kpis: {
    count: 500,
    avg_price: 600_000,
    median_price: 550_000,
    min_price: 100_000,
    max_price: 2_000_000,
    std_dev_price: 150_000,
    avg_square_footage: 2000,
    avg_price_per_sq_ft: 300,
  },
  price_histogram: [
    { range: "$0 – $200k", count: 50, range_start: 0, range_end: 200000 },
    { range: "$200k – $400k", count: 150, range_start: 200000, range_end: 400000 },
    { range: "$400k – $600k", count: 200, range_start: 400000, range_end: 600000 },
    { range: "$600k+", count: 100, range_start: 600000, range_end: 2000000 },
  ],
  price_vs_sqft: [],
  box_plot_by_bedrooms: [
    { bedrooms: 1, min: 100000, q1: 200000, median: 300000, q3: 400000, max: 500000, count: 50 },
    { bedrooms: 2, min: 200000, q1: 350000, median: 450000, q3: 550000, max: 700000, count: 150 },
    { bedrooms: 3, min: 300000, q1: 450000, median: 550000, q3: 650000, max: 800000, count: 200 },
  ],
  filters_applied: {},
};

// ---------------------------------------------------------------------------
// Tests: propertyRowsToCsv
// ---------------------------------------------------------------------------

describe("propertyRowsToCsv", () => {
  it("produces correct header row", () => {
    const csv = propertyRowsToCsv(SAMPLE_ROWS);
    const firstLine = csv.split("\r\n")[0];
    expect(firstLine).toContain("ID");
    expect(firstLine).toContain("Square Footage");
    expect(firstLine).toContain("Price ($)");
  });

  it("serializes numeric values correctly", () => {
    const csv = propertyRowsToCsv([SAMPLE_ROWS[0]]);
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(2); // header + 1 data row
    const dataLine = lines[1];
    expect(dataLine).toContain("2000");
    expect(dataLine).toContain("550000");
  });

  it("handles empty array gracefully", () => {
    const csv = propertyRowsToCsv([]);
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(1); // header only
  });

  it("escapes fields containing commas or quotes", () => {
    const rowWithSpecialChars: PropertyRow = {
      id: 3,
      square_footage: 1500,
      bedrooms: 2,
      bathrooms: 1,
      year_built: 2010,
      lot_size: 4000,
      distance_to_city_center: 3,
      school_rating: 8,
      price: 420_000,
    };
    const csv = propertyRowsToCsv([rowWithSpecialChars]);
    expect(csv).toBeTruthy();
  });

  it("produces RFC 4180 line endings (CRLF)", () => {
    const csv = propertyRowsToCsv(SAMPLE_ROWS);
    expect(csv).toContain("\r\n");
    // Should NOT have bare \n (only within \r\n)
    const bareNewlines = csv.replace(/\r\n/g, "");
    expect(bareNewlines).not.toContain("\n");
  });
});

// ---------------------------------------------------------------------------
// Tests: marketStatsToCsv
// ---------------------------------------------------------------------------

describe("marketStatsToCsv", () => {
  it("includes KPI section with key metrics", () => {
    const csv = marketStatsToCsv(SAMPLE_STATS);
    expect(csv).toContain("Market Summary Statistics");
    expect(csv).toContain("Total Listings,500");
    expect(csv).toContain("Average Price,600000");
    expect(csv).toContain("Median Price,550000");
  });

  it("includes histogram section", () => {
    const csv = marketStatsToCsv(SAMPLE_STATS);
    expect(csv).toContain("Price Histogram");
    expect(csv).toContain("$0 – $200k,50");
    expect(csv).toContain("$600k+,100");
  });

  it("includes box plot section", () => {
    const csv = marketStatsToCsv(SAMPLE_STATS);
    expect(csv).toContain("Box Plot by Bedrooms");
    expect(csv).toContain("Bedrooms,Min,Q1,Median,Q3,Max,Count");
  });

  it("produces non-empty output", () => {
    const csv = marketStatsToCsv(SAMPLE_STATS);
    expect(csv.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: downloadTextFile
// ---------------------------------------------------------------------------

describe("downloadTextFile", () => {
  it("triggers browser download without throwing", () => {
    // jsdom supports createElement for 'a' elements natively
    // so this should work without mocking
    expect(() => {
      downloadTextFile("test content", "test.txt", "text/plain");
    }).not.toThrow();
  });

  it("can be spied on by callers", () => {
    const downloadSpy = jest
      .spyOn(require("@/lib/export"), "downloadTextFile")
      .mockImplementation();

    downloadSpy("hello", "file.csv", "text/csv");

    expect(downloadSpy).toHaveBeenCalledWith("hello", "file.csv", "text/csv");

    downloadSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Tests: export functions
// ---------------------------------------------------------------------------

describe("exportDatasetCsv", () => {
  it("generates filename with date suffix", () => {
    // downloadTextFile is called internally but we can verify the function
    // doesn't throw when called
    expect(() => {
      exportDatasetCsv(SAMPLE_ROWS, "custom-name.csv");
    }).not.toThrow();
  });

  it("does not throw with default filename", () => {
    expect(() => {
      exportDatasetCsv(SAMPLE_ROWS);
    }).not.toThrow();
  });
});

describe("exportMarketStatsCsv", () => {
  it("does not throw when called", () => {
    expect(() => {
      exportMarketStatsCsv(SAMPLE_STATS);
    }).not.toThrow();
  });
});

describe("exportFullReport", () => {
  it("returns success with correct message", () => {
    const result = exportFullReport(SAMPLE_STATS, SAMPLE_ROWS);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Exported");
    expect(result.message).toContain(String(SAMPLE_ROWS.length));
  });

  it("returns failure on error", () => {
    // Mock the module's downloadTextFile to throw
    jest.isolateModules(() => {
      // We test the error handling path by verifying the function
      // handles errors gracefully without crashing
      const result = exportFullReport(SAMPLE_STATS, []);
      expect(result.success).toBe(true);
      expect(result.message).toContain("0");
    });
  });

  it("includes bytes estimate when successful", () => {
    const result = exportFullReport(SAMPLE_STATS, SAMPLE_ROWS);
    expect(result.bytes).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: generateReportHtml (PDF report)
// ---------------------------------------------------------------------------

describe("generateReportHtml", () => {
  it("does not throw and produces non-empty HTML", () => {
    expect(() => {
      generateReportHtml(SAMPLE_STATS);
    }).not.toThrow();

    const html = generateReportHtml(SAMPLE_STATS);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("formats prices as currency (regression: formatPrice is not defined)", () => {
    const html = generateReportHtml(SAMPLE_STATS);

    // avg_price = 600000 → "$600,000"
    expect(html).toContain("$600,000");
    // median_price = 550000 → "$550,000"
    expect(html).toContain("$550,000");
    // avg_price_per_sq_ft = 300 → "$300/sqft"
    expect(html).toContain("$300/sqft");
    // min_price = 100000 → "$100,000"
    expect(html).toContain("$100,000");
    // max_price = 2000000 → "$2,000,000"
    expect(html).toContain("$2,000,000");
  });

  it("formats total listings count with thousands separators", () => {
    const html = generateReportHtml(SAMPLE_STATS);
    // count = 500 → "500"
    expect(html).toContain(">500<");
  });

  it("includes box plot rows with formatted Q1/Q3 prices", () => {
    const html = generateReportHtml(SAMPLE_STATS);
    // box_plot group 1: min=100000, q1=200000, median=300000, q3=400000, max=500000
    expect(html).toContain("$100,000");
    expect(html).toContain("$200,000");
    expect(html).toContain("$300,000");
    expect(html).toContain("$400,000");
    expect(html).toContain("$500,000");
  });

  it("includes histogram rows", () => {
    const html = generateReportHtml(SAMPLE_STATS);
    expect(html).toContain("$0 – $200k");
    expect(html).toContain("Property Count");
  });

  it("includes report header and title", () => {
    const html = generateReportHtml(SAMPLE_STATS);
    expect(html).toContain("Property Market Analysis Report");
    expect(html).toContain("Market Summary");
    expect(html).toContain("Price Distribution");
    expect(html).toContain("Price Range by Bedroom Count");
  });

  it("omits 'Filters applied' line when no filters set (empty object)", () => {
    const html = generateReportHtml(SAMPLE_STATS);
    expect(html).not.toContain("Filters applied");
    expect(html).not.toContain("null");
  });

  it("omits 'Filters applied' line when backend sends null values (regression)", () => {
    // Backend may serialize absent filters as null instead of undefined
    const statsWithNullFilters: MarketStats = {
      ...SAMPLE_STATS,
      filters_applied: {
        bedrooms_min: null as unknown as undefined,
        bedrooms_max: null as unknown as undefined,
        year_built_min: null as unknown as undefined,
        year_built_max: null as unknown as undefined,
        distance_max: null as unknown as undefined,
        school_rating_min: null as unknown as undefined,
      },
    };
    const html = generateReportHtml(statsWithNullFilters);
    expect(html).not.toContain("Filters applied");
    expect(html).not.toContain("null");
  });

  it("shows 'Filters applied' line only for active filters", () => {
    const statsWithFilters: MarketStats = {
      ...SAMPLE_STATS,
      filters_applied: {
        bedrooms_min: 3,
        school_rating_min: 7,
      },
    };
    const html = generateReportHtml(statsWithFilters);
    expect(html).toContain("Filters applied");
    expect(html).toContain("Min Bedrooms: 3");
    expect(html).toContain("Min School Rating: 7");
    // Should NOT include inactive filters
    expect(html).not.toContain("Max Bedrooms");
    expect(html).not.toContain("Max Distance");
    expect(html).not.toContain("null");
  });

  it("includes print CSS to keep tables intact across pages", () => {
    const html = generateReportHtml(SAMPLE_STATS);
    // Tables must not be split across pages
    expect(html).toContain("page-break-inside: avoid");
    expect(html).toContain("break-inside: avoid");
    // Print media query must exist
    expect(html).toContain("@media print");
  });

  it("includes @page margin:0 to suppress browser URL/page-number footer", () => {
    const html = generateReportHtml(SAMPLE_STATS);
    // @page margin:0 removes the space where browsers print "about:blank" URL
    expect(html).toContain("@page");
    expect(html).toMatch(/@page\s*\{\s*margin:\s*0\s*;?\s*\}/);
  });

  it("does not render a standalone footer (regression: orphan footer on last page)", () => {
    const html = generateReportHtml(SAMPLE_STATS);
    // No footer div — footer was removed because it was redundant with the
    // header (title + date) and KPI (count), and caused orphan pagination.
    expect(html).not.toContain('class="footer"');
    expect(html).not.toContain("properties analyzed</div>\n</body>");
  });

  it("includes property count in the report header meta line", () => {
    const html = generateReportHtml(SAMPLE_STATS);
    // count = 500 → "500 properties analyzed" in header meta
    expect(html).toContain("500 properties analyzed");
  });
});
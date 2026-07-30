/**
 * Client-side data export utilities for the Property Market Analysis app.
 *
 * Provides CSV serialization and PDF export for market statistics
 * and property datasets. CSV uses RFC 4180 quoting; PDF uses the
 * browser's print-to-PDF capability via window.print() with a
 * dedicated print stylesheet (no heavy PDF library dependency).
 */

import type {
  KpiSummary,
  MarketStats,
  PropertyRow,
} from "@/lib/schemas/analytics";

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const CSV_HEADERS: { key: keyof PropertyRow; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "square_footage", label: "Square Footage" },
  { key: "bedrooms", label: "Bedrooms" },
  { key: "bathrooms", label: "Bathrooms" },
  { key: "year_built", label: "Year Built" },
  { key: "lot_size", label: "Lot Size (sq ft)" },
  { key: "distance_to_city_center", label: "Distance to City (mi)" },
  { key: "school_rating", label: "School Rating (/10)" },
  { key: "price", label: "Price ($)" },
];

/**
 * Escape a single CSV field per RFC 4180.
 * Quotes if the value contains comma, quote, CR, or LF.
 */
function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\r") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Serialise an array of property rows to a CSV string with headers. */
export function propertyRowsToCsv(rows: PropertyRow[]): string {
  const headerLine = CSV_HEADERS.map((h) => escapeCsvField(h.label)).join(",");
  const dataLines = rows.map((row) =>
    CSV_HEADERS.map((h) => escapeCsvField(row[h.key])).join(",")
  );
  return [headerLine, ...dataLines].join("\r\n");
}

/** Build a market stats summary as a CSV string (KPI + chart data). */
export function marketStatsToCsv(stats: MarketStats): string {
  const lines: string[] = [];

  // KPI section
  lines.push("Market Summary Statistics");
  lines.push("Metric,Value");
  const kpiEntries: Array<[string, number]> = [
    ["Total Listings", stats.kpis.count],
    ["Average Price", stats.kpis.avg_price],
    ["Median Price", stats.kpis.median_price],
    ["Minimum Price", stats.kpis.min_price],
    ["Maximum Price", stats.kpis.max_price],
    ["Std Dev Price", stats.kpis.std_dev_price],
    ["Avg Square Footage", stats.kpis.avg_square_footage],
    ["Avg Price per Sq Ft", stats.kpis.avg_price_per_sqft],
  ];
  kpiEntries.forEach(([label, value]) => {
    lines.push(`${escapeCsvField(label)},${escapeCsvField(value)}`);
  });

  lines.push("");
  lines.push("Price Histogram");
  lines.push("Range,Count,Range Start,Range End");
  stats.price_histogram.forEach((bin) => {
    lines.push(
      [bin.range, bin.count, bin.range_start, bin.range_end]
        .map(escapeCsvField)
        .join(",")
    );
  });

  lines.push("");
  lines.push("Box Plot by Bedrooms");
  lines.push("Bedrooms,Min,Q1,Median,Q3,Max,Count");
  stats.box_plot_by_bedrooms.forEach((group) => {
    lines.push(
      [
        group.bedrooms,
        group.min,
        group.q1,
        group.median,
        group.q3,
        group.max,
        group.count,
      ]
        .map(escapeCsvField)
        .join(",")
    );
  });

  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// File download helpers
// ---------------------------------------------------------------------------

/** Trigger a browser download for a text blob as a named file. */
export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export property dataset rows as a downloadable CSV file. */
export function exportDatasetCsv(rows: PropertyRow[], filename?: string): void {
  const csv = propertyRowsToCsv(rows);
  const ts = new Date().toISOString().slice(0, 10);
  downloadTextFile(csv, filename ?? `property-dataset-${ts}.csv`, "text/csv;charset=utf-8;");
}

/** Export market statistics as a downloadable CSV file. */
export function exportMarketStatsCsv(stats: MarketStats, filename?: string): void {
  const csv = marketStatsToCsv(stats);
  const ts = new Date().toISOString().slice(0, 10);
  downloadTextFile(csv, filename ?? `market-stats-${ts}.csv`, "text/csv;charset=utf-8;");
}

// ---------------------------------------------------------------------------
// PDF (via browser print)
// ---------------------------------------------------------------------------

/**
 * Trigger a browser print dialog for the given element.
 * The user can then "Save as PDF" from the print dialog.
 *
 * A temporary stylesheet hides everything except the target element
 * so only the dashboard content appears in the output.
 */
export function printToPdf(element: HTMLElement, title?: string): void {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    // Fallback: use the native print dialog on current page
    // which gives the option to save as PDF
    const originalDisplay = element.style.display;
    element.style.display = "block";
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    printWindow?.close(); // null check above — just in case
    alert("Please use the browser's 'Print' dialog and choose 'Save as PDF'.");
    document.body.style.overflow = prevOverflow;
    element.style.display = originalDisplay;
    return;
  }

  const printDoc = printWindow.document;
  printDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title ?? "Property Market Analysis"}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>${element.outerHTML}</body>
    </html>
  `);
  printDoc.close();
  printWindow.focus();
  // Give the browser a moment to render before triggering print
  setTimeout(() => {
    printWindow.print();
  }, 300);
}

// ---------------------------------------------------------------------------
// Export types
// ---------------------------------------------------------------------------

export interface ExportResult {
  success: boolean;
  message: string;
  bytes?: number;
}

/** Export both KPI summary and dataset as separate downloads. */
export function exportFullReport(
  stats: MarketStats,
  dataset: PropertyRow[]
): ExportResult {
  try {
    // Export stats CSV
    exportMarketStatsCsv(stats);

    // Export dataset CSV
    exportDatasetCsv(dataset);

    return {
      success: true,
      message: `Exported market stats and ${dataset.length} properties as CSV files.`,
      bytes: estimateBytes(stats, dataset),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Export failed",
    };
  }
}

function estimateBytes(stats: MarketStats, dataset: PropertyRow[]): number {
  const statsCsv = marketStatsToCsv(stats);
  const datasetCsv = propertyRowsToCsv(dataset);
  return new Blob([statsCsv, datasetCsv]).size;
}
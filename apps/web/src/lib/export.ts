/**
 * Client-side data export utilities for the Property Market Analysis app.
 *
 * Provides CSV serialization and PDF export for market statistics
 * and property datasets. CSV uses RFC 4180 quoting; PDF uses the
 * browser's print-to-PDF capability via window.print() with a
 * dedicated print stylesheet (no heavy PDF library dependency).
 */

import {
  formatNumber,
  formatPrice,
  type KpiSummary,
  type MarketStats,
  type PropertyRow,
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
    ["Avg Price per Sq Ft", stats.kpis.avg_price_per_sq_ft],
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
 * Generate a formatted HTML report from market statistics for PDF printing.
 *
 * Produces a clean, print-ready report with:
 * - Report header (title, date, filters applied)
 * - KPI summary table
 * - Price distribution histogram table
 * - Price range by bedroom count table
 *
 * The full property dataset is excluded (use CSV export for that).
 */
export function generateReportHtml(stats: MarketStats): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const filters = stats.filters_applied;
  const activeFilters: string[] = [];
  if (filters.bedrooms_min != null) activeFilters.push(`Min Bedrooms: ${filters.bedrooms_min}`);
  if (filters.bedrooms_max != null) activeFilters.push(`Max Bedrooms: ${filters.bedrooms_max}`);
  if (filters.year_built_min != null) activeFilters.push(`Min Year Built: ${filters.year_built_min}`);
  if (filters.year_built_max != null) activeFilters.push(`Max Year Built: ${filters.year_built_max}`);
  if (filters.distance_max != null) activeFilters.push(`Max Distance: ${filters.distance_max} mi`);
  if (filters.school_rating_min != null) activeFilters.push(`Min School Rating: ${filters.school_rating_min}`);

  const k = stats.kpis;

  const histogramRows = stats.price_histogram
    .map(
      (bin) =>
        `<tr><td>${bin.range}</td><td style="text-align:right">${bin.count}</td></tr>`
    )
    .join("");

  const boxPlotRows = stats.box_plot_by_bedrooms
    .map(
      (g) =>
        `<tr><td style="text-align:center">${g.bedrooms}</td><td style="text-align:right">${formatPrice(g.min)}</td><td style="text-align:right">${formatPrice(g.q1)}</td><td style="text-align:right">${formatPrice(g.median)}</td><td style="text-align:right">${formatPrice(g.q3)}</td><td style="text-align:right">${formatPrice(g.max)}</td><td style="text-align:right">${g.count}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Property Market Analysis Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { margin: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; line-height: 1.6; }
    .report-header { border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px; }
    .report-header h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; }
    .report-header .meta { font-size: 0.875rem; color: #64748b; margin-top: 4px; }
    .report-header .filters { font-size: 0.8rem; color: #4f46e5; margin-top: 8px; }
    h2 { font-size: 1.125rem; font-weight: 600; color: #0f172a; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; font-size: 0.875rem; margin-bottom: 16px; }
    th { background: #f1f5f9; color: #475569; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; }
    td { padding: 6px 12px; border: 1px solid #e2e8f0; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .kpi-card .label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi-card .value { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .kpi-card .desc { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
    @media print {
      body { padding: 15mm 18mm; }
      .kpi-grid { grid-template-columns: repeat(4, 1fr); margin-bottom: 12px; }
      .report-header { margin-bottom: 16px; }
      h2 { page-break-after: avoid; break-after: avoid; margin-top: 16px; margin-bottom: 8px; }
      table { page-break-inside: avoid; break-inside: avoid; margin-bottom: 12px; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>Property Market Analysis Report</h1>
    <div class="meta">Generated: ${dateStr} at ${timeStr} · ${formatNumber(k.count)} properties analyzed</div>
    ${activeFilters.length > 0 ? `<div class="filters">Filters applied: ${activeFilters.join(" · ")}</div>` : ""}
  </div>

  <h2>Market Summary</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="label">Total Listings</div>
      <div class="value">${formatNumber(k.count)}</div>
      <div class="desc">Properties in dataset</div>
    </div>
    <div class="kpi-card">
      <div class="label">Average Price</div>
      <div class="value">${formatPrice(k.avg_price)}</div>
      <div class="desc">${formatPrice(k.avg_price_per_sq_ft)}/sqft</div>
    </div>
    <div class="kpi-card">
      <div class="label">Median Price</div>
      <div class="value">${formatPrice(k.median_price)}</div>
      <div class="desc">Midpoint of all prices</div>
    </div>
    <div class="kpi-card">
      <div class="label">Price Range</div>
      <div class="value" style="font-size:1rem">${formatPrice(k.min_price)} – ${formatPrice(k.max_price)}</div>
      <div class="desc">Std dev: ${formatPrice(k.std_dev_price)}</div>
    </div>
  </div>

  <h2>Price Distribution</h2>
  <table>
    <thead>
      <tr><th>Price Range</th><th style="text-align:right">Property Count</th></tr>
    </thead>
    <tbody>
      ${histogramRows}
    </tbody>
  </table>

  <h2>Price Range by Bedroom Count</h2>
  <table>
    <thead>
      <tr>
        <th>Bedrooms</th>
        <th style="text-align:right">Min</th>
        <th style="text-align:right">Q1</th>
        <th style="text-align:right">Median</th>
        <th style="text-align:right">Q3</th>
        <th style="text-align:right">Max</th>
        <th style="text-align:right">Count</th>
      </tr>
    </thead>
    <tbody>
      ${boxPlotRows}
    </tbody>
  </table>
</body>
</html>`;
}

/**
 * Open a print dialog with a formatted business report from market statistics.
 * The user can then "Save as PDF" from the print dialog.
 */
export function printReport(stats: MarketStats): void {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Please allow pop-ups to generate the PDF report.");
    return;
  }

  const html = generateReportHtml(stats);
  const printDoc = printWindow.document;
  printDoc.write(html);
  printDoc.close();
  printDoc.title = "Property Market Analysis Report";
  printWindow.focus();
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
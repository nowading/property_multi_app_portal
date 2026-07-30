"use client";

import { useCallback, useRef, useState } from "react";

import { Download, FileText, Printer, Table } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  exportDatasetCsv,
  exportFullReport,
  exportMarketStatsCsv,
  printToPdf,
  type ExportResult,
} from "@/lib/export";
import type { MarketStats, PropertyRow } from "@/lib/schemas/analytics";

export interface ExportPanelProps {
  stats: MarketStats;
  dataset: PropertyRow[];
  /** Optional override for dataset CSV export (for testing). */
  onExportDataset?: (rows: PropertyRow[]) => void;
  /** Optional override for market stats CSV export (for testing). */
  onExportStats?: (stats: MarketStats) => void;
  /** Optional override for PDF export (for testing). */
  onExportPdf?: (element: HTMLElement) => void;
  /** Optional override for full report export (for testing). */
  onExportAll?: (stats: MarketStats, dataset: PropertyRow[]) => ExportResult;
}

/**
 * Export controls for the Property Market Analysis dashboard.
 *
 * Provides three export options:
 *  1. Dataset as CSV (all property rows)
 *  2. Market statistics as CSV (KPI + histogram + box plot)
 *  3. Full report as PDF (via browser print dialog)
 *
 * Also supports "Export All" for convenience.
 *
 * Export functions can be overridden via props for testing.
 */
export function ExportPanel({
  stats,
  dataset,
  onExportDataset,
  onExportStats,
  onExportPdf,
  onExportAll,
}: ExportPanelProps) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportDataset = useCallback(() => {
    try {
      setIsExporting(true);
      if (onExportDataset) {
        onExportDataset(dataset);
      } else {
        exportDatasetCsv(dataset);
      }
      setLastResult({
        success: true,
        message: `Exported ${dataset.length} properties as CSV.`,
      });
    } catch (error) {
      setLastResult({
        success: false,
        message: error instanceof Error ? error.message : "Export failed",
      });
    } finally {
      setIsExporting(false);
    }
  }, [dataset, onExportDataset]);

  const handleExportStats = useCallback(() => {
    try {
      setIsExporting(true);
      if (onExportStats) {
        onExportStats(stats);
      } else {
        exportMarketStatsCsv(stats);
      }
      setLastResult({
        success: true,
        message: "Exported market statistics as CSV.",
      });
    } catch (error) {
      setLastResult({
        success: false,
        message: error instanceof Error ? error.message : "Export failed",
      });
    } finally {
      setIsExporting(false);
    }
  }, [stats, onExportStats]);

  const handleExportPdf = useCallback(() => {
    if (!dashboardRef.current) return;
    try {
      setIsExporting(true);
      if (onExportPdf) {
        onExportPdf(dashboardRef.current);
      } else {
        printToPdf(dashboardRef.current, "Property Market Analysis Report");
      }
      setLastResult({
        success: true,
        message: "Opened print dialog. Use 'Save as PDF' to download.",
      });
    } catch (error) {
      setLastResult({
        success: false,
        message: error instanceof Error ? error.message : "Export failed",
      });
    } finally {
      setIsExporting(false);
    }
  }, [onExportPdf]);

  const handleExportAll = useCallback(() => {
    try {
      setIsExporting(true);
      const result = onExportAll
        ? onExportAll(stats, dataset)
        : exportFullReport(stats, dataset);
      setLastResult(result);
    } finally {
      setIsExporting(false);
    }
  }, [stats, dataset, onExportAll]);

  return (
    <div ref={dashboardRef}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Download property dataset and market analysis in various formats
              </CardDescription>
            </div>
            {lastResult && (
              <p
                className={`text-sm ${
                  lastResult.success ? "text-emerald-600" : "text-rose-600"
                }`}
                role="status"
                aria-live="polite"
              >
                {lastResult.message}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ExportButton
              label="Dataset (CSV)"
              description={`${dataset.length} properties`}
              icon={<Table className="h-4 w-4" />}
              onClick={handleExportDataset}
              disabled={isExporting || dataset.length === 0}
            />
            <ExportButton
              label="Statistics (CSV)"
              description="KPI, histogram, box plot"
              icon={<FileText className="h-4 w-4" />}
              onClick={handleExportStats}
              disabled={isExporting}
            />
            <ExportButton
              label="Report (PDF)"
              description="Print dashboard to PDF"
              icon={<Printer className="h-4 w-4" />}
              onClick={handleExportPdf}
              disabled={isExporting}
            />
            <ExportButton
              label="Export All"
              description="Both CSVs in one click"
              icon={<Download className="h-4 w-4" />}
              onClick={handleExportAll}
              disabled={isExporting}
              variant="primary"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ExportButtonProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary";
}

function ExportButton({
  label,
  description,
  icon,
  onClick,
  disabled,
  variant = "default",
}: ExportButtonProps) {
  const baseStyles =
    "flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variantStyles =
    variant === "primary"
      ? "border-primary-600 bg-primary-600 text-white hover:bg-primary-700"
      : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-300";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles}`}
      aria-label={`Export ${label}`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      <span
        className={`text-xs ${
          variant === "primary" ? "text-primary-100" : "text-slate-500"
        }`}
      >
        {description}
      </span>
    </button>
  );
}
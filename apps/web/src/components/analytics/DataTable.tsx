"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  formatNumber,
  formatPrice,
  type PropertyRow,
} from "@/lib/schemas/analytics";

type SortDirection = "asc" | "desc";

interface ColumnDef {
  key: keyof PropertyRow;
  label: string;
  sortable: boolean;
  className?: string;
  formatter?: (value: number, row: PropertyRow) => string;
}

const COLUMNS: ColumnDef[] = [
  {
    key: "id",
    label: "ID",
    sortable: true,
    className: "w-16",
  },
  {
    key: "square_footage",
    label: "Sq Ft",
    sortable: true,
    className: "w-24",
    formatter: (v) => formatNumber(v),
  },
  {
    key: "bedrooms",
    label: "Beds",
    sortable: true,
    className: "w-16",
  },
  {
    key: "bathrooms",
    label: "Baths",
    sortable: true,
    className: "w-16",
  },
  {
    key: "year_built",
    label: "Year",
    sortable: true,
    className: "w-20",
  },
  {
    key: "lot_size",
    label: "Lot Size",
    sortable: true,
    className: "w-24",
    formatter: (v) => formatNumber(v),
  },
  {
    key: "distance_to_city_center",
    label: "Distance",
    sortable: true,
    className: "w-24",
    formatter: (v) => `${v.toFixed(1)} mi`,
  },
  {
    key: "school_rating",
    label: "School",
    sortable: true,
    className: "w-20",
    formatter: (v) => `${v.toFixed(1)}/10`,
  },
  {
    key: "price",
    label: "Price",
    sortable: true,
    className: "w-28 text-right font-medium",
    formatter: (v) => formatPrice(v),
  },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export interface DataTableProps {
  data: PropertyRow[];
  /** Total count (when server-side pagination is used). */
  total?: number;
  /** Initial page size. */
  initialPageSize?: number;
}

/**
 * Responsive data table for property dataset rows.
 *
 * Features:
 * - Sortable columns (click header to toggle asc/desc)
 * - Client-side pagination with configurable page size
 * - Responsive: horizontal scroll on narrow viewports
 * - Accessible: ARIA sort indicators, keyboard-navigable
 */
export function DataTable({
  data,
  total,
  initialPageSize = 10,
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<keyof PropertyRow>("price");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const effectiveTotal = total ?? data.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));

  const sortedData = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      const cmp = aVal < bVal ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const handleSort = useCallback(
    (key: keyof PropertyRow) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
      setPage(1);
    },
    [sortKey]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      const clamped = Math.max(1, Math.min(totalPages, newPage));
      setPage(clamped);
    },
    [totalPages]
  );

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Property Listings</CardTitle>
            <CardDescription>
              {effectiveTotal.toLocaleString()} properties · showing{" "}
              {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, effectiveTotal)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="page-size" className="text-slate-600">
              Rows per page:
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table
            className="w-full text-left text-sm"
            aria-label="Property listings data table"
          >
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      sortKey === col.key
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={`px-3 py-2 font-medium text-slate-600 ${col.className ?? ""}`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        aria-label={`Sort by ${col.label}`}
                      >
                        {col.label}
                        <SortIcon
                          direction={
                            sortKey === col.key ? sortDir : undefined
                          }
                        />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedData.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  {COLUMNS.map((col) => {
                    const value = row[col.key];
                    const formatted = col.formatter
                      ? col.formatter(value, row)
                      : String(value);
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2 text-slate-700 ${col.className ?? ""}`}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {pagedData.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-3 py-8 text-center text-slate-500"
                  >
                    No properties match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <nav
          aria-label="Pagination"
          className="mt-4 flex items-center justify-between text-sm"
        >
          <div className="text-slate-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Previous page"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        </nav>
      </CardContent>
    </Card>
  );
}

function SortIcon({ direction }: { direction?: SortDirection }) {
  if (!direction) {
    return (
      <span
        aria-hidden="true"
        className="inline-block text-slate-300"
      >
        ⇅
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-block text-primary-600"
    >
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}
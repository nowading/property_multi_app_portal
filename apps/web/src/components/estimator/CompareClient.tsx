"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, GitCompare } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { useEstimatorHistory } from "@/hooks/useEstimatorHistory";
import {
  FEATURE_RANGES,
  FIELD_CONFIGS,
  type HistoryEntry,
} from "@/lib/schemas/estimator";

export interface CompareClientProps {
  /**
   * Optional initial selection of entry IDs (typically from `?ids=a,b`).
   * When omitted, the component reads from `useSearchParams` at runtime.
   */
  initialIds?: string[];
  /**
   * Optional controlled entries source (tests bypass the hook). When
   * omitted, the component subscribes via `useEstimatorHistory`.
   */
  entries?: HistoryEntry[];
}

const MIN_SELECTION = 2;
const MAX_SELECTION = 4;

/**
 * Compare view: select 2–4 saved estimates and view them side-by-side.
 *
 * Layout:
 *  - Selection card with one checkbox per available history entry.
 *    Disabled beyond MAX_SELECTION so the user can't over-select.
 *  - Comparison table: rows = each of the 7 features + a final
 *    predicted-price row; columns = each selected entry.
 *  - Grouped Recharts BarChart: X axis = feature labels, one bar per
 *    selected entry (normalised to 0–100 via FEATURE_RANGES so all 7
 *    features share a common scale).
 *
 * Accessibility:
 *  - The table uses `<caption>` and `scope="col"|"row"`.
 *  - Each checkbox has a visible `<label>` bound by `htmlFor`.
 *  - The chart is `aria-hidden` (decorative); the table conveys the
 *    precise values.
 */
export function CompareClient({
  initialIds,
  entries,
}: CompareClientProps) {
  const hook = useEstimatorHistory();
  const list = entries ?? hook.entries;
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds ?? []);

  // Keep selection valid if entries change (e.g. user removes one from
  // another tab): drop any IDs no longer present.
  useEffect(() => {
    if (!entries) return; // only sync when using the hook
    const validIds = new Set(list.map((e) => e.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [entries, list]);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => list.find((e) => e.id === id))
        .filter((e): e is HistoryEntry => e !== undefined),
    [selectedIds, list]
  );

  const chartData = useMemo(
    () => buildGroupedChartData(selected),
    [selected]
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-slate-500" aria-hidden="true" />
            Select Estimates to Compare
          </CardTitle>
          <CardDescription>
            Pick {MIN_SELECTION}–{MAX_SELECTION} saved estimates. The table
            and chart below update automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-slate-500">
              No saved estimates yet.{" "}
              <Link
                href="/estimator"
                className="font-medium text-primary-700 hover:text-primary-800"
              >
                Run an estimate first
              </Link>
              .
            </p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Available estimates</legend>
              {list.map((entry) => {
                const id = entry.id;
                const checked = selectedIds.includes(id);
                const disabled =
                  !checked && selectedIds.length >= MAX_SELECTION;
                return (
                  <label
                    key={id}
                    htmlFor={`compare-${id}`}
                    className={`flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm ${
                      disabled
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:bg-slate-50"
                    }`}
                  >
                    <input
                      id={`compare-${id}`}
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => {
                        setSelectedIds((prev) =>
                          e.target.checked
                            ? [...prev, id]
                            : prev.filter((x) => x !== id)
                        );
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="flex-1">
                      <span className="font-medium text-slate-900">
                        {formatPrice(entry.predicted_price)}
                      </span>
                      <span className="ml-2 text-slate-500">
                        {formatTimestamp(entry.timestamp)} ·{" "}
                        {entry.features.square_footage} sqft ·{" "}
                        {entry.features.bedrooms} bed
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}
        </CardContent>
      </Card>

      {selected.length < MIN_SELECTION ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <BarChart3 className="h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="text-sm text-slate-600">
              {selected.length === 0
                ? `Select at least ${MIN_SELECTION} estimates above to compare them.`
                : "Select one more estimate to start the comparison."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ComparisonTable selected={selected} />
          <ComparisonChart selected={selected} data={chartData} />
        </>
      )}
    </div>
  );
}

// ---- comparison table --------------------------------------------------

function ComparisonTable({ selected }: { selected: HistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Side-by-Side Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">
              Feature values and predicted prices for each selected estimate
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Feature
                </th>
                {selected.map((entry, idx) => (
                  <th key={entry.id} scope="col" className="py-2 pr-4 font-medium">
                    Estimate {idx + 1}
                    <br />
                    <span className="font-normal normal-case text-slate-400">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELD_CONFIGS.map((field) => (
                <tr
                  key={field.name}
                  className="border-b border-slate-100 last:border-0"
                >
                  <th
                    scope="row"
                    className="py-2 pr-4 text-left font-medium text-slate-700"
                  >
                    {field.label}
                    {field.unit ? (
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        ({field.unit})
                      </span>
                    ) : null}
                  </th>
                  {selected.map((entry) => (
                    <td key={entry.id} className="py-2 pr-4 text-slate-900">
                      {formatFeatureValue(entry.features[field.name], field.name)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <th
                  scope="row"
                  className="py-3 pr-4 text-left font-semibold text-slate-900"
                >
                  Predicted Price
                </th>
                {selected.map((entry) => {
                  const prices = selected.map((e) => e.predicted_price);
                  const max = Math.max(...prices);
                  const isMax = entry.predicted_price === max;
                  return (
                    <td key={entry.id} className="py-3 pr-4">
                      <Badge variant={isMax ? "success" : "default"}>
                        {formatPrice(entry.predicted_price)}
                      </Badge>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- comparison chart --------------------------------------------------

interface ChartDatum {
  label: string;
  [entryKey: string]: string | number;
}

function ComparisonChart({
  selected,
  data,
}: {
  selected: HistoryEntry[];
  data: ChartDatum[];
}) {
  // Stable colours per entry index — keeps the legend consistent across renders.
  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Normalised Feature Comparison</CardTitle>
        <CardDescription>
          Each feature is scaled to 0–100 based on its allowed range so all
          seven features can share one axis. Higher = more of that feature.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="h-80 w-full"
          aria-hidden="true"
          data-testid="compare-chart-container"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#475569" }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#475569" }}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "rgba(148, 163, 184, 0.15)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
                formatter={(value: unknown, name: unknown) =>
                  [
                    `${Number(value).toFixed(1)} / 100`,
                    String(name),
                  ] as [string, string]
                }
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(_value, _entry, idx) => `Estimate ${idx + 1}`}
              />
              {selected.map((entry, idx) => (
                <Bar
                  key={entry.id}
                  dataKey={entry.id}
                  name={`Estimate ${idx + 1}`}
                  fill={colors[idx % colors.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- helpers -----------------------------------------------------------

function buildGroupedChartData(selected: HistoryEntry[]): ChartDatum[] {
  return FIELD_CONFIGS.map((field) => {
    const range = FEATURE_RANGES[field.name];
    const span = range.max - range.min || 1;
    const row: ChartDatum = { label: field.label };
    for (const entry of selected) {
      const raw = entry.features[field.name];
      const clamped = Math.min(Math.max(raw, range.min), range.max);
      row[entry.id] = ((clamped - range.min) / span) * 100;
    }
    return row;
  });
}

function formatFeatureValue(
  value: number,
  fieldName: keyof typeof FEATURE_RANGES
): string {
  // Year-built and bedrooms read better as plain integers.
  if (fieldName === "year_built" || fieldName === "bedrooms") {
    return String(value);
  }
  // The rest keep their original precision.
  return String(value);
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

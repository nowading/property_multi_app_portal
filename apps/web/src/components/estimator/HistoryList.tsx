"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { useEstimatorHistory } from "@/hooks/useEstimatorHistory";
import { FIELD_CONFIGS, type HistoryEntry } from "@/lib/schemas/estimator";

export interface HistoryListProps {
  /**
   * Optional controlled entries source. When omitted, the component
   * manages its own `useEstimatorHistory` subscription — useful for the
   * `/estimator/history` page. Tests pass entries directly to avoid
   * mocking localStorage.
   */
  entries?: HistoryEntry[];
  /** Optional callbacks; default to the internal hook. */
  onRemove?: (id: string) => void;
  onClear?: () => void;
}

/**
 * Renders the user's saved estimates as a responsive table.
 *
 * Each row shows:
 *  - timestamp (formatted)
 *  - predicted price (currency)
 *  - a compact feature summary (sqft / bed / bath / year)
 *  - actions: "Re-estimate" (links to `/estimator?id=...`) and "Remove"
 *
 * Top right has a "Clear all" button. When the list is empty, a friendly
 * empty state with a link to `/estimator` is shown.
 */
export function HistoryList({
  entries,
  onRemove,
  onClear,
}: HistoryListProps) {
  const hook = useEstimatorHistory();
  const list = entries ?? hook.entries;
  const remove = onRemove ?? hook.removeEntry;
  const clear = onClear ?? hook.clearAll;
  const router = useRouter();

  if (list.length === 0) {
    return <EmptyState />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-slate-500" aria-hidden="true" />
          Saved Estimates ({list.length})
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (
              window.confirm(
                "Remove all saved estimates? This cannot be undone."
              )
            ) {
              clear();
            }
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear all
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">
              Previously saved property estimates
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Date
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Predicted Price
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Features
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-medium text-slate-700"
                  >
                    <time dateTime={new Date(entry.timestamp).toISOString()}>
                      {formatTimestamp(entry.timestamp)}
                    </time>
                  </th>
                  <td className="py-3 pr-4">
                    <Badge variant="success">
                      {formatPrice(entry.predicted_price)}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    <FeatureSummary entry={entry} />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/estimator/compare?ids=${encodeURIComponent(entry.id)}`
                          )
                        }
                      >
                        Compare
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(entry.id)}
                        aria-label={`Remove estimate from ${formatTimestamp(
                          entry.timestamp
                        )}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <History
          className="h-10 w-10 text-slate-300"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium text-slate-700">
            No saved estimates yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Run an estimate on the Estimator page and it will appear here
            automatically.
          </p>
        </div>
        <Link
          href="/estimator"
          className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700"
        >
          Go to Estimator
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * Renders a compact human-readable summary of an entry's key features.
 * Shows the four most decision-relevant fields (sqft, bed, bath, year).
 */
function FeatureSummary({ entry }: { entry: HistoryEntry }) {
  const labels: string[] = [];
  for (const field of FIELD_CONFIGS) {
    const value = entry.features[field.name];
    const formatted =
      field.name === "year_built"
        ? String(value)
        : `${value}${field.unit ? ` ${field.unit}` : ""}`;
    labels.push(`${field.label}: ${formatted}`);
    if (labels.length === 4) break;
  }
  return <span>{labels.join(" · ")}</span>;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString("en-US", {
    year: "numeric",
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

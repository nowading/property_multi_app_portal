"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { EstimatorClient } from "./EstimatorClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { useEstimatorHistory } from "@/hooks/useEstimatorHistory";

/**
 * Client-side wrapper for the `/estimator` route.
 *
 * Wires the `useEstimatorHistory` hook to `EstimatorClient.onResult` so
 * that every successful prediction is appended to localStorage. Also
 * renders a compact "Recent estimates" preview at the bottom with a link
 * to the full `/estimator/history` page — but only when at least one
 * entry exists, so first-time users don't see an empty callout.
 */
export function EstimatorPageClient() {
  const { entries, addEntry } = useEstimatorHistory();
  const recent = entries.slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <EstimatorClient onResult={addEntry} />

      {recent.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Estimates</CardTitle>
            <Link
              href="/estimator/history"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800"
            >
              View all
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {recent.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-600">
                    {new Date(entry.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {entry.predicted_price.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

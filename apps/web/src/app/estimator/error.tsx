"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";

/**
 * Route-segment error boundary for `/estimator/*`.
 *
 * Overrides the global `app/error.tsx` so the fallback copy is
 * contextual to the estimator app. Like the global boundary, it must
 * be a Client Component and receives the thrown `error` plus a `reset`
 * callback that re-attempts rendering the route segment.
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/error
 */
export default function EstimatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this would forward to a structured logger with
    // service_name="web" and trace_id propagation.
    console.error("[portal] estimator route error:", error);
  }, [error]);

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center"
      role="alert"
    >
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-semibold text-slate-900">
          Estimator unavailable
        </h2>
        <p className="max-w-md text-sm text-slate-500">
          We couldn&apos;t load the Property Value Estimator. This is usually
          transient — please try again. If the problem persists, the
          estimator backend may be offline.
        </p>
      </div>

      {error.digest && (
        <p className="text-xs text-slate-400">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={reset} variant="primary">
          Try again
        </Button>
        <Link
          href="/estimator/history"
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          View saved estimates
        </Link>
      </div>
    </div>
  );
}

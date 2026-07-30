"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal] analytics route error:", error);
  }, [error]);

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center"
      role="alert"
    >
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-semibold text-slate-900">
          Dashboard unavailable
        </h2>
        <p className="max-w-md text-sm text-slate-500">
          We couldn&apos;t load the Market Analysis dashboard. This is usually
          transient — please try again. If the problem persists, the
          analytics backend may be offline.
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
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

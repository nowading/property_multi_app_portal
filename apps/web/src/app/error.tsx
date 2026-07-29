"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";

/**
 * Global error boundary for the App Router.
 *
 * Must be a Client Component. Receives the thrown error and a `reset`
 * callback that re-attempts rendering the route segment.
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/error
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this would forward to a structured logger.
    console.error("[portal] route error:", error);
  }, [error]);

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center"
      role="alert"
    >
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-semibold text-slate-900">
          Something went wrong
        </h2>
        <p className="max-w-md text-sm text-slate-500">
          An unexpected error occurred while rendering this page. You can try
          again, or navigate to another section via the sidebar.
        </p>
      </div>

      {error.digest && (
        <p className="text-xs text-slate-400">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}

      <Button onClick={reset} variant="primary">
        Try again
      </Button>
    </div>
  );
}

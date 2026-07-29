/**
 * Global loading boundary for the App Router.
 *
 * Shown automatically by Next.js while a route segment's server component
 * or data fetch is in flight. Kept intentionally lightweight — no client JS.
 */
export default function Loading() {
  return (
    <div
      className="flex flex-1 items-center justify-center py-16"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600"
          aria-hidden="true"
        />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  );
}

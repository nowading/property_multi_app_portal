import { EstimatorComparePageClient } from "@/components/estimator/EstimatorComparePageClient";

export const metadata = {
  title: "Compare Estimates",
};

/**
 * `/estimator/compare` (RSC shell).
 *
 * Renders the compare UI allowing the user to pick 2–4 saved estimates
 * and view them side-by-side. Initial selection can be seeded via the
 * `?ids=a,b` query parameter (set by the "Compare" button on the
 * history page).
 */
export default function ComparePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Compare Estimates</h1>
        <p className="text-sm text-slate-600">
          Select two to four saved estimates to view their features and
          predicted prices side-by-side.
        </p>
      </div>

      <EstimatorComparePageClient />
    </div>
  );
}

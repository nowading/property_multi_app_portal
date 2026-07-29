import { EstimatorPageClient } from "@/components/estimator/EstimatorPageClient";

export const metadata = {
  title: "Property Value Estimator",
};

/**
 * Estimator page (RSC shell).
 *
 * Delegates all interactivity (form, submit lifecycle, loading/error/result,
 * and history persistence) to the <EstimatorPageClient> client component,
 * which wires `useEstimatorHistory` to <EstimatorClient.onResult>.
 */
export default function EstimatorPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">
          Property Value Estimator
        </h1>
        <p className="text-sm text-slate-600">
          Enter the property features below to estimate its value. All seven
          fields are required and validated client-side before submission.
        </p>
      </div>

      <EstimatorPageClient />
    </div>
  );
}

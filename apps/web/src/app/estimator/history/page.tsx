import { HistoryList } from "@/components/estimator/HistoryList";

export const metadata = {
  title: "Estimate History",
};

/**
 * `/estimator/history` (RSC shell).
 *
 * Renders the full list of saved estimates stored in localStorage. The
 * <HistoryList> client component subscribes to the `useEstimatorHistory`
 * hook and updates live as the user adds/removes entries (including
 * cross-tab via the `storage` event).
 */
export default function HistoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Estimate History</h1>
        <p className="text-sm text-slate-600">
          Every estimate you run is saved to this browser&apos;s local storage
          (up to 50 entries). Use this page to revisit, compare, or remove
          past estimates.
        </p>
      </div>

      <HistoryList />
    </div>
  );
}

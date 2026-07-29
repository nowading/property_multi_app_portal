"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { CompareClient } from "./CompareClient";

/**
 * Client wrapper for `/estimator/compare` that reads the optional
 * `?ids=a,b,c` query parameter (set by the HistoryList "Compare"
 * button) and seeds `CompareClient.initialIds`.
 *
 * Wrapped in <Suspense> because `useSearchParams` opts the component
 * into client-side Suspense boundaries in the App Router.
 */
export function EstimatorComparePageClient() {
  return (
    <Suspense fallback={null}>
      <CompareClientWithParams />
    </Suspense>
  );
}

function CompareClientWithParams() {
  const searchParams = useSearchParams();
  const rawIds = searchParams.get("ids") ?? "";
  const initialIds = rawIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return <CompareClient initialIds={initialIds} />;
}

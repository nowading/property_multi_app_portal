import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { WhatIfTool } from "@/components/analytics/WhatIfTool";
import { serverFetch } from "@/lib/server-fetch";
import {
  DEFAULT_WHAT_IF_FEATURES,
  type WhatIfFeatures,
} from "@/lib/schemas/analytics";

export const metadata = {
  title: "What-If Analysis",
};

const ANALYTICS_API_URL =
  process.env.ANALYTICS_API_URL || "http://localhost:8002";

export default async function WhatIfPage() {
  let initialFeatures: WhatIfFeatures = DEFAULT_WHAT_IF_FEATURES;

  try {
    const modelInfo = await serverFetch<{ features: WhatIfFeatures }>(
      `${ANALYTICS_API_URL}/api/model-info`,
      { next: { revalidate: 300 } }
    );
    if (modelInfo?.features) {
      initialFeatures = modelInfo.features;
    }
  } catch {
    initialFeatures = DEFAULT_WHAT_IF_FEATURES;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/analytics"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">What-If Analysis</h1>
        <p className="text-sm text-slate-600">
          Explore how changing individual property features affects the
          predicted market price. Use the sliders to model different scenarios
          and see the delta compared to the baseline.
        </p>
      </div>

      <Suspense fallback={<p className="text-slate-500">Loading tool…</p>}>
        <WhatIfTool initialFeatures={initialFeatures} />
      </Suspense>
    </div>
  );
}
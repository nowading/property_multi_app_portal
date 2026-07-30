import { Suspense } from "react";

import { WhatIfTool } from "@/components/analytics/WhatIfTool";

export const metadata = {
  title: "What-If Analysis",
};

export default function WhatIfPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">What-If Analysis</h1>
        <p className="text-sm text-slate-600">
          Explore how changing individual property features affects the
          predicted market price. Use the sliders to model different scenarios
          and see the delta compared to the baseline.
        </p>
      </div>

      <Suspense fallback={<p className="text-slate-500">Loading tool…</p>}>
        <WhatIfTool />
      </Suspense>
    </div>
  );
}
"use client";

import { useCallback, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { runWhatIfAnalysis } from "@/lib/mock/predict";
import {
  DEFAULT_WHAT_IF_FEATURES,
  WHAT_IF_FEATURES,
  formatPrice,
  type WhatIfFeatures,
  type WhatIfResult,
} from "@/lib/schemas/analytics";

export interface WhatIfToolProps {
  /** Initial features (defaults to DEFAULT_WHAT_IF_FEATURES). */
  initialFeatures?: WhatIfFeatures;
  /** Optional callback when prediction changes. */
  onChange?: (result: WhatIfResult) => void;
}

/**
 * What-if analysis tool for the Property Market Analysis dashboard.
 *
 * Provides sliders for all 7 ML features and shows a live predicted
 * price alongside the baseline (default) price and the delta between them.
 *
 * Currently uses a mock prediction function. Will integrate with the
 * real ML API in Phase 5.
 */
export function WhatIfTool({
  initialFeatures,
  onChange,
}: WhatIfToolProps) {
  const [features, setFeatures] = useState<WhatIfFeatures>(
    () => initialFeatures ?? DEFAULT_WHAT_IF_FEATURES
  );

  const result = useMemo(
    () => runWhatIfAnalysis(features),
    [features]
  );

  const handleFeatureChange = useCallback(
    (key: keyof WhatIfFeatures, value: number) => {
      const next = { ...features, [key]: value };
      setFeatures(next);
      onChange?.(runWhatIfAnalysis(next));
    },
    [features, onChange]
  );

  const handleReset = useCallback(() => {
    setFeatures(DEFAULT_WHAT_IF_FEATURES);
    onChange?.(runWhatIfAnalysis(DEFAULT_WHAT_IF_FEATURES));
  }, [onChange]);

  const deltaIsPositive = result.delta >= 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>What-If Analysis</CardTitle>
            <CardDescription>
              Adjust property features to see how they affect the predicted
              price. Baseline uses median market values.
            </CardDescription>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline"
          >
            Reset to baseline
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Sliders panel */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {WHAT_IF_FEATURES.map((def) => (
                <FeatureSlider
                  key={def.name}
                  meta={def}
                  value={features[def.name]}
                  onChange={(v) => handleFeatureChange(def.name, v)}
                />
              ))}
            </div>
          </div>

          {/* Result panel */}
          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm text-slate-500">Predicted Price</p>
              <p
                data-testid="predicted-price"
                className="text-3xl font-bold text-slate-900"
              >
                {formatPrice(result.predicted_price)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Baseline Price</p>
              <p className="text-xl text-slate-700">
                {formatPrice(result.baseline_price)}
              </p>
            </div>

            <div
              className={`rounded-md px-3 py-2 ${
                deltaIsPositive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              <p className="text-sm font-medium">
                {deltaIsPositive ? "▲" : "▼"} Delta vs baseline
              </p>
              <p className="text-lg font-semibold">
                {deltaIsPositive ? "+" : ""}
                {formatPrice(result.delta)} ({deltaIsPositive ? "+" : ""}
                {result.delta_percent.toFixed(1)}%)
              </p>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <p className="mb-2 text-sm font-medium text-slate-600">
                Feature Values
              </p>
              <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                {WHAT_IF_FEATURES.map((def) => (
                  <div key={def.name} className="flex justify-between">
                    <dt className="text-slate-500">{def.label}</dt>
                    <dd className="font-medium text-slate-700">
                      {formatFeatureValue(features[def.name], def.unit)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface FeatureSliderProps {
  meta: (typeof WHAT_IF_FEATURES)[number];
  value: number;
  onChange: (value: number) => void;
}

function FeatureSlider({ meta, value, onChange }: FeatureSliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={`what-if-${meta.name}`}
          className="text-sm font-medium text-slate-700"
        >
          {meta.label}
        </label>
        <span className="text-sm font-medium tabular-nums text-slate-900">
          {formatFeatureValue(value, meta.unit)}
        </span>
      </div>
      <input
        id={`what-if-${meta.name}`}
        type="range"
        min={meta.min}
        max={meta.max}
        step={meta.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-primary-600"
        aria-label={`${meta.label} slider`}
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{formatFeatureValue(meta.min, meta.unit)}</span>
        <span>{formatFeatureValue(meta.max, meta.unit)}</span>
      </div>
    </div>
  );
}

function formatFeatureValue(value: number, unit: string): string {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return unit ? `${formatted} ${unit}` : formatted;
}
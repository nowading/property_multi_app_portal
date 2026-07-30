"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { postWhatIf } from "@/lib/api-analytics";
import { getErrorMessage } from "@/lib/error-messages";
import { ApiError } from "@/lib/api";
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

export function WhatIfTool({
  initialFeatures,
  onChange,
}: WhatIfToolProps) {
  const [features, setFeatures] = useState<WhatIfFeatures>(
    () => initialFeatures ?? DEFAULT_WHAT_IF_FEATURES
  );
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceFetch, setForceFetch] = useState(0);

  const requestIdRef = useRef(0);
  const isFirstRenderRef = useRef(true);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const fetchPrediction = useCallback(
    async (feats: WhatIfFeatures, shouldNotify: boolean) => {
      const id = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const data = await postWhatIf(feats);
        if (requestIdRef.current === id) {
          setResult(data);
          setIsLoading(false);
          if (shouldNotify) {
            onChangeRef.current?.(data);
          }
        }
      } catch (err) {
        if (requestIdRef.current === id) {
          const message =
            err instanceof ApiError
              ? getErrorMessage(err.code)
              : getErrorMessage("UNKNOWN_ERROR");
          setError(message);
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const shouldNotify = !isFirstRenderRef.current;
    isFirstRenderRef.current = false;

    const timer = setTimeout(() => {
      fetchPrediction(features, shouldNotify);
    }, shouldNotify ? 300 : 0);

    return () => clearTimeout(timer);
  }, [features, forceFetch, fetchPrediction]);

  const handleFeatureChange = useCallback(
    (key: keyof WhatIfFeatures, value: number) => {
      setFeatures((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleReset = useCallback(() => {
    setFeatures(DEFAULT_WHAT_IF_FEATURES);
    setForceFetch((c) => c + 1);
  }, []);

  const deltaIsPositive = result ? result.delta >= 0 : true;

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
            {isLoading && (
              <div
                data-testid="loading-indicator"
                className="flex items-center justify-center py-8 text-sm text-slate-500"
              >
                Analyzing...
              </div>
            )}

            {error && !isLoading && (
              <div
                data-testid="error-card"
                className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
              >
                <p className="font-medium">Error</p>
                <p>{error}</p>
              </div>
            )}

            {!isLoading && !error && result === null && (
              <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                Click to analyze
              </div>
            )}

            {result && !isLoading && !error && (
              <>
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
                          {formatFeatureValue(
                            result.features[def.name],
                            def.unit
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </>
            )}
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
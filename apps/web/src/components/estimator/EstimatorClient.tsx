"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";

import { ApiError, apiFetch } from "@/lib/api";
import { ESTIMATOR_API_URL } from "@/lib/api-config";
import type {
  PredictionResult,
  PropertyFeatures,
  PropertyFeaturesInput,
} from "@/lib/schemas/estimator";

import { EstimatorForm } from "./EstimatorForm";
import { ResultDisplay } from "./ResultDisplay";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

interface EstimatorClientProps {
  /** Optional initial features (used when loading from history/compare). */
  initialFeatures?: PropertyFeatures | null;
  /**
   * Optional callback fired after a successful prediction. The estimator
   * page uses this to persist the estimate to localStorage history via
   * the `useEstimatorHistory` hook (kept out of this component so it
   * stays focused on the form/result lifecycle and is trivially testable
   * in isolation).
   */
  onResult?: (features: PropertyFeatures, result: PredictionResult) => void;
}

/**
 * Client-side orchestrator for the estimator page.
 *
 * Owns the submit lifecycle (loading → result | error) and delegates the
 * form rendering + validation to <EstimatorForm>. Calls the FastAPI
 * estimator-api `POST /predict` endpoint via `apiFetch`, which unwraps
 * the unified envelope and throws `ApiError` on any failure.
 *
 * The most recently submitted features are kept in state so that
 * <ResultDisplay> can render a tabular breakdown of the inputs alongside
 * the predicted price and Recharts feature-contribution chart.
 */
export function EstimatorClient({
  initialFeatures = null,
  onResult,
}: EstimatorClientProps) {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFeatures, setLastFeatures] = useState<PropertyFeatures | null>(
    initialFeatures
  );

  async function handleSubmit(values: PropertyFeatures) {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PredictionResult>(
        `${ESTIMATOR_API_URL}/predict`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
          // Per §3.1: predictions are never cached.
          cache: "no-store",
        }
      );
      setResult(data);
      setLastFeatures(values);
      onResult?.(values, data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN_ERROR", String(err))
      );
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EstimatorForm
            onSubmit={handleSubmit}
            isLoading={isLoading}
            initialValues={initialFeatures ? toInput(initialFeatures) : undefined}
          />
        </CardContent>
      </Card>

      {isLoading && <LoadingState />}

      {!isLoading && error && <ErrorState error={error} />}

      {!isLoading && !error && result && (
        <ResultDisplay result={result} features={lastFeatures} />
      )}
    </div>
  );
}

/** Convert typed numeric features back to the string-shaped form input. */
function toInput(features: PropertyFeatures): PropertyFeaturesInput {
  const out: Partial<Record<keyof PropertyFeatures, string>> = {};
  for (const [k, v] of Object.entries(features)) {
    out[k as keyof PropertyFeatures] = String(v);
  }
  return out as PropertyFeaturesInput;
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary-600" aria-hidden="true" />
        <p className="text-sm text-slate-600">
          Estimating property value…
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ error }: { error: ApiError }) {
  return (
    <Card className="border-red-200">
      <CardContent className="flex flex-col gap-2 py-5">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-red-700">
            Estimation failed
          </h3>
          <Badge variant="danger">{error.code}</Badge>
        </div>
        <p className="text-sm text-slate-600">{error.message}</p>
      </CardContent>
    </Card>
  );
}

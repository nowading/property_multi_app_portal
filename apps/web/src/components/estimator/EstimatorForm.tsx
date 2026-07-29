"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  EMPTY_FEATURES,
  FIELD_CONFIGS,
  propertyFeaturesSchema,
  type PropertyFeatures,
  type PropertyFeaturesInput,
} from "@/lib/schemas/estimator";

type FieldErrors = Partial<Record<keyof PropertyFeatures, string>>;

export interface EstimatorFormProps {
  /** Called with validated, typed features when the form submits successfully. */
  onSubmit: (values: PropertyFeatures) => void;
  /** Disables the submit button and shows a spinner when true. */
  isLoading?: boolean;
  /** Optional initial values (e.g. when loading from history). */
  initialValues?: PropertyFeaturesInput;
  /** Optional CTA label. */
  submitLabel?: string;
}

/**
 * Property features input form with zod validation.
 *
 * - All 7 ML features rendered from FIELD_CONFIGS.
 * - On submit, runs `propertyFeaturesSchema.safeParse`; on failure, maps
 *   zod issues to per-field error messages and re-renders inline.
 * - On success, calls `onSubmit` with the typed (numeric) values.
 */
export function EstimatorForm({
  onSubmit,
  isLoading = false,
  initialValues = EMPTY_FEATURES,
  submitLabel = "Estimate Value",
}: EstimatorFormProps) {
  const [values, setValues] = useState<PropertyFeaturesInput>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});

  function handleChange(field: keyof PropertyFeatures, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear the error for this field as the user edits.
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = propertyFeaturesSchema.safeParse(values);
    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof PropertyFeatures;
        if (!nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELD_CONFIGS.map((field) => (
          <Input
            key={field.name}
            id={field.name}
            label={field.label}
            hint={field.unit ? `${field.hint ?? ""} (${field.unit})`.trim() : field.hint}
            error={errors[field.name]}
            type="number"
            inputMode={field.step && field.step.includes(".") ? "decimal" : "numeric"}
            step={field.step}
            placeholder={field.placeholder}
            value={values[field.name]}
            onChange={(e) => handleChange(field.name, e.target.value)}
            disabled={isLoading}
          />
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="submit" isLoading={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

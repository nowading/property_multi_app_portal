import { z } from "zod";

/**
 * Zod schema for the 7 ML model input features.
 *
 * Input shape (from <input> elements) is all strings; output shape is
 * typed numbers. `z.string().min(1)` enforces "required", then `.transform`
 * parses to a number, and `.refine` applies the numeric range.
 *
 * Feature names match the ML container's `/predict` request payload
 * (see PROJECT_PLAN.md §1 — ML Features).
 */

const currentYear = new Date().getFullYear();

interface NumberFieldOptions {
  min: number;
  max: number;
  integer?: boolean;
  rangeMessage?: string;
}

function numberField(opts: NumberFieldOptions) {
  return z
    .string()
    .min(1, "This field is required")
    .transform((val, ctx) => {
      const n = opts.integer ? parseInt(val, 10) : parseFloat(val);
      if (Number.isNaN(n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Must be a valid number",
        });
        return z.NEVER;
      }
      return n;
    })
    .refine(
      (n) => n >= opts.min && n <= opts.max,
      opts.rangeMessage ?? `Must be between ${opts.min} and ${opts.max}`
    );
}

export const propertyFeaturesSchema = z.object({
  square_footage: numberField({
    min: 100,
    max: 100_000,
    rangeMessage: "Must be between 100 and 100,000 sq ft",
  }),
  bedrooms: numberField({
    min: 0,
    max: 20,
    integer: true,
    rangeMessage: "Must be an integer between 0 and 20",
  }),
  bathrooms: numberField({
    min: 0,
    max: 20,
    rangeMessage: "Must be between 0 and 20",
  }),
  year_built: numberField({
    min: 1800,
    max: currentYear,
    integer: true,
    rangeMessage: `Must be between 1800 and ${currentYear}`,
  }),
  lot_size: numberField({
    min: 0,
    max: 1_000_000,
    rangeMessage: "Must be between 0 and 1,000,000 sq ft",
  }),
  distance_to_city_center: numberField({
    min: 0,
    max: 500,
    rangeMessage: "Must be between 0 and 500 miles",
  }),
  school_rating: numberField({
    min: 1,
    max: 10,
    rangeMessage: "Must be between 1 and 10",
  }),
});

/** Form-facing input (all strings, straight from <input> values). */
export type PropertyFeaturesInput = z.input<typeof propertyFeaturesSchema>;

/** Parsed output (numbers) — matches the ML container's payload shape. */
export type PropertyFeatures = z.output<typeof propertyFeaturesSchema>;

/**
 * Per-feature contribution to the predicted price (coefficient × value).
 *
 * Populated by the estimator-api in Phase 3 when it proxies the ML
 * container's `/model-info` coefficients. Optional in Phase 2.3 — when
 * absent, the result view falls back to a normalised feature-value chart.
 */
export interface FeatureContribution {
  feature: string;
  value: number;
  contribution: number;
}

/**
 * Prediction result returned by the estimator-api `/predict` endpoint
 * (after `apiFetch` unwraps the unified envelope's `data`).
 *
 * Mirrors the ML container's `PredictResponse.prediction` field, renamed
 * to `predicted_price` for clarity at the portal layer.
 */
export interface PredictionResult {
  predicted_price: number;
  contributions?: FeatureContribution[];
}

/**
 * A saved estimate in the user's history (localStorage, see §3.1 of
 * PROJECT_PLAN.md — max 50 entries, FIFO eviction).
 *
 * `id` is a stable client-generated ULID-ish string so React keys and
 * `removeEntry(id)` lookups are deterministic. `timestamp` is the
 * epoch milliseconds at save time.
 */
export interface HistoryEntry {
  id: string;
  timestamp: number;
  features: PropertyFeatures;
  predicted_price: number;
}

/** Maximum number of entries retained in localStorage. Older entries drop first. */
export const HISTORY_MAX_ENTRIES = 50;

/**
 * Min/max ranges per feature for normalising values to a 0–100 scale in
 * the fallback chart (when `contributions` is absent).
 */
export const FEATURE_RANGES: Record<
  keyof PropertyFeatures,
  { min: number; max: number }
> = {
  square_footage: { min: 100, max: 100_000 },
  bedrooms: { min: 0, max: 20 },
  bathrooms: { min: 0, max: 20 },
  year_built: { min: 1800, max: new Date().getFullYear() },
  lot_size: { min: 0, max: 1_000_000 },
  distance_to_city_center: { min: 0, max: 500 },
  school_rating: { min: 1, max: 10 },
};

/** Field metadata for rendering the form (labels, units, hints, step). */
export interface FieldConfig {
  name: keyof PropertyFeatures;
  label: string;
  unit?: string;
  placeholder: string;
  step?: string;
  hint?: string;
}

export const FIELD_CONFIGS: readonly FieldConfig[] = [
  {
    name: "square_footage",
    label: "Square Footage",
    unit: "sq ft",
    placeholder: "2000",
    step: "1",
    hint: "Total interior living area",
  },
  {
    name: "bedrooms",
    label: "Bedrooms",
    placeholder: "3",
    step: "1",
    hint: "Integer count (0–20)",
  },
  {
    name: "bathrooms",
    label: "Bathrooms",
    placeholder: "2",
    step: "0.5",
    hint: "Fractions allowed (e.g. 2.5)",
  },
  {
    name: "year_built",
    label: "Year Built",
    placeholder: "1990",
    step: "1",
    hint: `Between 1800 and ${currentYear}`,
  },
  {
    name: "lot_size",
    label: "Lot Size",
    unit: "sq ft",
    placeholder: "5000",
    step: "1",
    hint: "Total land area",
  },
  {
    name: "distance_to_city_center",
    label: "Distance to City Center",
    unit: "miles",
    placeholder: "5",
    step: "0.1",
    hint: "From the property to downtown",
  },
  {
    name: "school_rating",
    label: "School Rating",
    unit: "/ 10",
    placeholder: "8",
    step: "0.1",
    hint: "Average rating of nearby schools (1–10)",
  },
] as const;

/** Empty initial values for the form (all fields blank strings). */
export const EMPTY_FEATURES: PropertyFeaturesInput = {
  square_footage: "",
  bedrooms: "",
  bathrooms: "",
  year_built: "",
  lot_size: "",
  distance_to_city_center: "",
  school_rating: "",
};

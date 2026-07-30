"use client";

import { useCallback } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FILTER_DEFINITIONS, type StatsFilters } from "@/lib/schemas/analytics";

export interface FilterPanelProps {
  filters: StatsFilters;
  onChange: (filters: StatsFilters) => void;
  onReset?: () => void;
}

/**
 * Filter panel for the analytics dashboard.
 *
 * Provides range sliders for key property attributes:
 * - Bedroom count range (min/max)
 * - Year built range (min/max)
 * - Max distance to city center
 * - Min school rating
 *
 * Each slider updates the parent's filter state via `onChange`.
 */
export function FilterPanel({ filters, onChange, onReset }: FilterPanelProps) {
  const handleChange = useCallback(
    (key: keyof StatsFilters, value: number | undefined) => {
      onChange({ ...filters, [key]: value });
    },
    [filters, onChange]
  );

  const activeCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== 0
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              {activeCount > 0
                ? `${activeCount} filter${activeCount === 1 ? "" : "s"} active`
                : "No filters applied — showing all properties"}
            </CardDescription>
          </div>
          {onReset && activeCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="text-sm text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {FILTER_DEFINITIONS.map((def) => (
            <FilterSlider
              key={def.name}
              label={def.label}
              min={def.min}
              max={def.max}
              step={def.step}
              unit={def.unit}
              value={filters[def.name]}
              onChange={(v) => handleChange(def.name, v)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface FilterSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

function FilterSlider({
  label,
  min,
  max,
  step,
  unit,
  value,
  onChange,
}: FilterSliderProps) {
  const hasValue = value !== undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm tabular-nums text-slate-500">
          {hasValue ? formatValue(value, unit) : "Any"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hasValue ? value : max}
          disabled={!hasValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-primary-600 disabled:opacity-40"
          aria-label={`${label} range slider`}
        />
        {hasValue && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
            aria-label={`Clear ${label} filter`}
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{formatValue(min, unit)}</span>
        <span>{formatValue(max, unit)}</span>
      </div>
    </div>
  );
}

function formatValue(value: number | undefined, unit: string): string {
  if (value === undefined) return "Any";
  const rounded = Number.isInteger(value) ? value : value.toFixed(1);
  return unit ? `${rounded}${unit}` : String(rounded);
}

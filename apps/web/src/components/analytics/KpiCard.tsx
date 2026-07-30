"use client";

import { cn } from "@/lib/cn";

export type KpiTrend = "up" | "down" | "flat";

export interface KpiCardProps {
  label: string;
  value: string;
  trend?: KpiTrend;
  trendValue?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

const TREND_CLASSES: Record<KpiTrend, string> = {
  up: "text-emerald-600",
  down: "text-red-600",
  flat: "text-slate-500",
};

const TREND_ARROWS: Record<KpiTrend, string> = {
  up: "▲",
  down: "▼",
  flat: "―",
};

/**
 * KPI summary card — displays a key metric with optional trend indicator.
 *
 * Used on the analytics dashboard to show market statistics like average
 * price, median price, total listings, etc.
 */
export function KpiCard({
  label,
  value,
  trend,
  trendValue,
  description,
  icon,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            {icon}
          </span>
        )}
      </div>

      <div className="text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>

      <div className="flex items-center gap-2 text-xs">
        {trend && trendValue && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              TREND_CLASSES[trend]
            )}
            aria-label={`${trend} trend: ${trendValue}`}
          >
            <span aria-hidden="true">{TREND_ARROWS[trend]}</span>
            {trendValue}
          </span>
        )}
        {description && (
          <span className="text-slate-400">{description}</span>
        )}
      </div>
    </div>
  );
}

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { formatPrice } from "@/lib/schemas/analytics";
import type { BoxPlotGroup } from "@/lib/schemas/analytics";

export interface BedroomBoxPlotProps {
  data: BoxPlotGroup[];
}

interface ChartDataItem {
  bedrooms: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

function prepareChartData(data: BoxPlotGroup[]): ChartDataItem[] {
  return data.map((g) => ({
    bedrooms: `${g.bedrooms} BR`,
    min: g.min,
    q1: g.q1,
    median: g.median,
    q3: g.q3,
    max: g.max,
    count: g.count,
  }));
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: ChartDataItem }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-sm font-medium text-slate-900">
        {label} · {d.count} properties
      </p>
      <dl className="mt-1 grid grid-cols-2 gap-x-4 text-xs text-slate-500">
        <dt>Min Price</dt><dd className="text-right">{formatPrice(d.min)}</dd>
        <dt>Q1 (25% of homes cheaper)</dt><dd className="text-right">{formatPrice(d.q1)}</dd>
        <dt>Median Price</dt><dd className="text-right font-medium text-slate-700">{formatPrice(d.median)}</dd>
        <dt>Q3 (75% of homes cheaper)</dt><dd className="text-right">{formatPrice(d.q3)}</dd>
        <dt>Max Price</dt><dd className="text-right">{formatPrice(d.max)}</dd>
      </dl>
    </div>
  );
};

/**
 * Price range by bedroom count.
 *
 * Shows min, Q1 (25th percentile), median, Q3 (75th percentile), and max
 * prices for each bedroom-count group as a grouped bar chart. All bars
 * start from 0, with heights representing actual price values.
 */
export function BedroomBoxPlot({ data }: BedroomBoxPlotProps) {
  const chartData = prepareChartData(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Range by Bedroom Count</CardTitle>
        <CardDescription>
          Price spread for each bedroom group. Q1 means 25% of homes in the
          group cost less than this price; Q3 means 75% cost less. Hover any
          bar for exact values.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full" role="img" aria-label="Price range by bedroom count bar chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="bedrooms"
                tick={{ fontSize: 12, fill: "#64748b" }}
                label={{
                  value: "Bedrooms",
                  position: "insideBottom",
                  offset: -5,
                  style: { fill: "#64748b", fontSize: 12 },
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                }
                label={{
                  value: "Price ($)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#64748b", fontSize: 12 },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="min" fill="#cbd5e1" name="Min Price" isAnimationActive={false} />
              <Bar dataKey="q1" fill="#a5b4fc" name="Q1 (25% of homes cheaper)" isAnimationActive={false} />
              <Bar dataKey="median" fill="#6366f1" name="Median Price" isAnimationActive={false} />
              <Bar dataKey="q3" fill="#4f46e5" name="Q3 (75% of homes cheaper)" isAnimationActive={false} />
              <Bar dataKey="max" fill="#3730a3" name="Max Price" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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

interface BoxPlotBarData {
  bedrooms: number;
  offset: number;
  iqr: number;
  median: number;
  rangeOffset: number;
  rangeHeight: number;
  q1Value: number;
  q3Value: number;
  min: number;
  max: number;
  count: number;
}

/**
 * Compute a simplified box-plot data representation for Recharts.
 *
 * Stacked bars in Recharts always start from 0. To render an IQR box
 * that starts at Q1 and ends at Q3, we need:
 * - An invisible "offset" bar from 0 to Q1
 * - A visible "iqr" bar from Q1 to Q3 (height = Q3 - Q1)
 *
 * Similarly for the full range (min→max):
 * - An invisible "rangeOffset" bar from 0 to min
 * - A visible "rangeHeight" bar from min to max
 */
function prepareBoxPlotData(data: BoxPlotGroup[]): BoxPlotBarData[] {
  return data.map((g) => {
    const iqr = g.q3 - g.q1;
    const rangeHeight = g.max - g.min;
    return {
      bedrooms: g.bedrooms,
      offset: g.q1, // invisible offset for IQR stack
      iqr, // visible IQR height
      median: g.median,
      rangeOffset: g.min, // invisible offset for range stack
      rangeHeight, // visible range height
      q1Value: g.q1,
      q3Value: g.q3,
      min: g.min,
      max: g.max,
      count: g.count,
    };
  });
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: BoxPlotBarData }> }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-sm font-medium text-slate-900">
        {d.bedrooms} Bedrooms · {d.count} properties
      </p>
      <dl className="mt-1 grid grid-cols-2 gap-x-4 text-xs text-slate-500">
        <dt>Median</dt><dd className="text-right">{formatPrice(d.median)}</dd>
        <dt>Q1</dt><dd className="text-right">{formatPrice(d.q1Value)}</dd>
        <dt>Q3</dt><dd className="text-right">{formatPrice(d.q3Value)}</dd>
        <dt>Min</dt><dd className="text-right">{formatPrice(d.min)}</dd>
        <dt>Max</dt><dd className="text-right">{formatPrice(d.max)}</dd>
      </dl>
    </div>
  );
};

/**
 * Box plot by bedroom count.
 *
 * Shows the price distribution (min, Q1, median, Q3, max) for each
 * bedroom-count group, visualised as stacked bars.
 */
export function BedroomBoxPlot({ data }: BedroomBoxPlotProps) {
  const plotData = prepareBoxPlotData(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Range by Bedroom Count</CardTitle>
        <CardDescription>
          Median, IQR, and range of prices grouped by bedroom count
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full" role="img" aria-label="Box plot of price by bedroom count">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={plotData}
              margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              barCategoryGap="25%"
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
              {/* Full range (min→max): invisible offset + visible height */}
              <Bar
                dataKey="rangeOffset"
                stackId="range"
                fill="transparent"
                isAnimationActive={false}
              />
              <Bar
                dataKey="rangeHeight"
                stackId="range"
                fill="#e2e8f0"
                isAnimationActive={false}
                name="Range"
              />
              {/* IQR box (Q1→Q3): invisible offset + visible IQR */}
              <Bar
                dataKey="offset"
                stackId="iqr"
                fill="transparent"
                isAnimationActive={false}
              />
              <Bar
                dataKey="iqr"
                stackId="iqr"
                fill="#6366f1"
                isAnimationActive={false}
                name="IQR"
              />
              {/* Median as a thin separate bar */}
              <Bar
                dataKey="median"
                fill="#4f46e5"
                isAnimationActive={false}
                barSize={4}
                name="Median"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

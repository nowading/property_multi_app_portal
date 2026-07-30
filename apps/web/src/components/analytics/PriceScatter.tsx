"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { formatPrice } from "@/lib/schemas/analytics";
import type { ScatterPoint } from "@/lib/schemas/analytics";

export interface PriceScatterProps {
  data: ScatterPoint[];
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-sm font-medium text-slate-900">
        {formatPrice(point.price)}
      </p>
      <p className="text-sm text-slate-500">
        {point.square_footage.toLocaleString()} sq ft · {point.bedrooms} bdrm
      </p>
    </div>
  );
};

/**
 * Price vs Square Footage scatter plot.
 *
 * Each dot represents a property. The Z-axis maps to bedroom count,
 * giving a visual indication of how bedrooms correlate with price and size.
 *
 * Both axes use `type="number"` with an explicit `domain` so dots are
 * positioned at their true numeric values (not ordinal/category positions).
 * This keeps dots aligned with axis ticks at any container width.
 */
export function PriceScatter({ data }: PriceScatterProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price vs. Square Footage</CardTitle>
        <CardDescription>
          Each dot is a property. Bubble size = bedroom count.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full" role="img" aria-label="Price vs square footage scatter plot">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="square_footage"
                type="number"
                name="Sq Ft"
                domain={[(dataMin: number) => Math.max(0, dataMin - 200), (dataMax: number) => dataMax + 200]}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v: number) => v.toLocaleString()}
                label={{
                  value: "Square Footage",
                  position: "insideBottom",
                  offset: -5,
                  style: { fill: "#64748b", fontSize: 12 },
                }}
              />
              <YAxis
                dataKey="price"
                type="number"
                name="Price"
                domain={[(dataMin: number) => Math.max(0, dataMin - 50000), (dataMax: number) => dataMax + 50000]}
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
              <ZAxis
                dataKey="bedrooms"
                range={[20, 80]}
                name="Bedrooms"
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter
                data={data}
                fill="#6366f1"
                fillOpacity={0.45}
                stroke="#4f46e5"
                strokeWidth={0.5}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

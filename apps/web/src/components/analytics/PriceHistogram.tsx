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
import type { HistogramBin } from "@/lib/schemas/analytics";

export interface PriceHistogramProps {
  data: HistogramBin[];
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: HistogramBin }> }) => {
  if (!active || !payload?.length) return null;
  const bin = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-sm font-medium text-slate-900">{bin.range}</p>
      <p className="text-sm text-slate-500">{bin.count} properties</p>
    </div>
  );
};

/**
 * Price histogram chart — shows the distribution of property prices.
 *
 * Renders a bar chart with price ranges on the X axis and property count
 * on the Y axis. Each bar represents a price bin.
 */
export function PriceHistogram({ data }: PriceHistogramProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Distribution</CardTitle>
        <CardDescription>
          Number of properties by price range
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full" role="img" aria-label="Price distribution histogram">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 11, fill: "#64748b" }}
                angle={-30}
                textAnchor="end"
                height={50}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
                label={{
                  value: "Properties",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#64748b", fontSize: 12 },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
              >
                {data.map((entry, index) => (
                  <rect
                    key={`cell-${index}`}
                    fill={index % 2 === 0 ? "#6366f1" : "#818cf8"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

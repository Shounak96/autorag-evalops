"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartDataPoint {
  name: string;
  passRate: number;
  grounding: number;
  latencySeconds: number;
}

interface MetricsChartsProps {
  data: ChartDataPoint[];
}

function EmptyChartState() {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
      <p className="text-sm text-slate-500">
        Run an evaluation dataset to generate chart data.
      </p>
    </div>
  );
}

export function MetricsCharts({
  data,
}: MetricsChartsProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Evaluation quality trend
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Pass rate and grounding score across recent dataset runs.
          </p>
        </div>

        <div className="mt-6 h-[280px] w-full min-w-0">
          {data.length === 0 ? (
            <EmptyChartState />
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={280}
              initialDimension={{
                width: 800,
                height: 280,
              }}
            >
              <LineChart data={data}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#e2e8f0"
                />

                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => `${value}%`}
                />

                <Tooltip
                  formatter={(value) =>
                    `${Number(value ?? 0).toFixed(1)}%`
                    }
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="passRate"
                  name="Pass rate"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />

                <Line
                  type="monotone"
                  dataKey="grounding"
                  name="Grounding"
                  stroke="#0891b2"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Average pipeline latency
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            End-to-end execution time for each evaluation run.
          </p>
        </div>

        <div className="mt-6 h-[280px] w-full min-w-0">
          {data.length === 0 ? (
            <EmptyChartState />
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={280}
              initialDimension={{
                width: 800,
                height: 280,
              }}
            >
              <AreaChart data={data}>
                <defs>
                  <linearGradient
                    id="latencyGradient"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#8b5cf6"
                      stopOpacity={0.35}
                    />

                    <stop
                      offset="95%"
                      stopColor="#8b5cf6"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#e2e8f0"
                />

                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => `${value}s`}
                />

                <Tooltip
                  formatter={(value) =>
                    `${Number(value ?? 0).toFixed(2)} seconds`
                    }
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="latencySeconds"
                  name="Latency"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  fill="url(#latencyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
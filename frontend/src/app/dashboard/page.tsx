import {
  Activity,
  BrainCircuit,
  Database,
  FileStack,
  Gauge,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

import { MetricCard } from "@/components/dashboard/metric-card";
import { MetricsCharts } from "@/components/dashboard/metrics-charts";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { apiGet } from "@/lib/api";
import type {
  DocumentListResponse,
  EvalDatasetListResponse,
  EvalRunListResponse,
  PromptComparisonListResponse,
  PromptVersionListResponse,
} from "@/lib/types";

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatLatency(value: number): string {
  if (!value) {
    return "0.0s";
  }

  return `${(value / 1000).toFixed(1)}s`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWinner(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function DashboardPage() {
  const [
    documents,
    datasets,
    prompts,
    evalRuns,
    comparisons,
  ] = await Promise.all([
    apiGet<DocumentListResponse>(
      "/documents",
      {
        documents: [],
        count: 0,
      },
    ),
    apiGet<EvalDatasetListResponse>(
      "/eval/datasets",
      { datasets: [], count: 0 } as EvalDatasetListResponse,
    ),
    apiGet<PromptVersionListResponse>(
      "/prompts",
      { prompts: [], count: 0 } as PromptVersionListResponse,
    ),
    apiGet<EvalRunListResponse>(
      "/eval/runs?limit=8",
      { runs: [], count: 0 },
    ),
    apiGet<PromptComparisonListResponse>(
      "/eval/prompt-comparisons?limit=4",
      { comparisons: [], count: 0 },
    ),
  ]);

  const latestRun = evalRuns.runs[0] ?? null;

  const averageGrounding =
    evalRuns.runs.length > 0
      ? evalRuns.runs.reduce(
          (total, run) => total + run.avg_grounding_score,
          0,
        ) / evalRuns.runs.length
      : 0;

  const averageLatency =
    evalRuns.runs.length > 0
      ? evalRuns.runs.reduce(
          (total, run) => total + run.avg_latency_ms,
          0,
        ) / evalRuns.runs.length
      : 0;

  const chartData = [...evalRuns.runs]
    .reverse()
    .map((run, index) => ({
      name: `Run ${index + 1}`,
      passRate: run.pass_rate * 100,
      grounding: run.avg_grounding_score * 100,
      latencySeconds: Number(
        (run.avg_latency_ms / 1000).toFixed(2),
      ),
    }));

  return (
    <div className="mx-auto max-w-[1600px]">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Advanced Agentic RAG Evaluation
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            System overview
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Monitor document ingestion, regression-test quality,
            grounding performance, latency, and prompt A/B
            comparisons from one workspace.
          </p>
        </div>

        {latestRun ? (
          <StatusBadge
            variant={
              latestRun.quality_gate_passed
                ? "success"
                : "warning"
            }
          >
            Latest quality gate:{" "}
            {latestRun.quality_gate_passed ? "Passed" : "Failed"}
          </StatusBadge>
        ) : (
          <StatusBadge variant="neutral">
            No evaluation runs yet
          </StatusBadge>
        )}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          title="Documents"
          value={String(documents.count)}
          description="Uploaded knowledge sources available for retrieval."
          icon={FileStack}
          accentClassName="bg-indigo-50 text-indigo-600"
        />

        <MetricCard
          title="Datasets"
          value={String(datasets.count)}
          description="Reusable RAG regression suites configured."
          icon={Database}
          accentClassName="bg-cyan-50 text-cyan-600"
        />

        <MetricCard
          title="Prompt versions"
          value={String(prompts.count)}
          description="Versioned prompts available for controlled testing."
          icon={BrainCircuit}
          accentClassName="bg-violet-50 text-violet-600"
        />

        <MetricCard
          title="Evaluation runs"
          value={String(evalRuns.count)}
          description="Historical quality-gate executions currently stored."
          icon={Activity}
          accentClassName="bg-sky-50 text-sky-600"
        />

        <MetricCard
          title="Avg grounding"
          value={formatPercentage(averageGrounding)}
          description="Claim-level evidence support across recent runs."
          icon={ShieldCheck}
          accentClassName="bg-emerald-50 text-emerald-600"
        />

        <MetricCard
          title="Avg latency"
          value={formatLatency(averageLatency)}
          description="Current end-to-end evaluation execution time."
          icon={Gauge}
          accentClassName="bg-amber-50 text-amber-600"
        />
      </section>

      <section className="mt-8">
        <MetricsCharts data={chartData} />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">
              Recent evaluation runs
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Historical dataset evaluations and quality-gate outcomes.
            </p>
          </div>

          {evalRuns.runs.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No evaluation runs are available yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      Dataset
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Prompt
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Gate
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Pass rate
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Latency
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Created
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {evalRuns.runs.map((run) => (
                    <tr
                      key={run.rag_run_id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                        {run.dataset_name ?? "Unnamed dataset"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {run.prompt_version_name ?? "Built-in prompt"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <StatusBadge
                          variant={
                            run.quality_gate_passed
                              ? "success"
                              : "warning"
                          }
                        >
                          {run.quality_gate_passed
                            ? "Passed"
                            : "Failed"}
                        </StatusBadge>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatPercentage(run.pass_rate)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatLatency(run.avg_latency_ms)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                        {formatDate(run.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">
              Recent prompt comparisons
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Stored A/B reports with comparison-validity checks.
            </p>
          </div>

          {comparisons.comparisons.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No prompt comparisons are available yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {comparisons.comparisons.map((comparison) => (
                <div
                  key={comparison.comparison_id}
                  className="p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {comparison.prompt_version_a_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        vs. {comparison.prompt_version_b_name}
                      </p>
                    </div>

                    <StatusBadge
                      variant={
                        comparison.comparison_valid
                          ? "success"
                          : "warning"
                      }
                    >
                      {comparison.comparison_valid
                        ? "Valid comparison"
                        : "Fallback affected"}
                    </StatusBadge>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Winner
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatWinner(comparison.winner)}
                    </p>
                  </div>

                  {!comparison.comparison_valid &&
                    comparison.comparison_warning && (
                      <p className="mt-3 text-xs leading-5 text-amber-700">
                        {comparison.comparison_warning}
                      </p>
                    )}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
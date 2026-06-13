"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  GitCompare,
  LoaderCircle,
  RefreshCw,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import { listPromptComparisons } from "@/lib/prompt-comparisons-api";
import type { PromptComparison } from "@/lib/types";

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatScore(value: number): string {
  return value.toFixed(4);
}

function formatLatencyDelta(value: number): string {
  const sign = value > 0 ? "+" : "";

  if (Math.abs(value) < 1000) {
    return `${sign}${value.toFixed(0)} ms`;
  }

  return `${sign}${(value / 1000).toFixed(2)} s`;
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";

  return `${sign}${formatPercentage(value)}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function formatWinner(winner: string): string {
  return winner
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ABComparisonsWorkspace() {
  const [comparisons, setComparisons] = useState<
    PromptComparison[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshComparisons() {
    setLoading(true);
    setError(null);

    try {
      const response = await listPromptComparisons();

      setComparisons(response.comparisons);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    listPromptComparisons()
      .then((response) => {
        if (!cancelled) {
          setComparisons(response.comparisons);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const validComparisons = comparisons.filter(
    (comparison) => comparison.comparison_valid,
  ).length;

  const fallbackAffected =
    comparisons.length - validComparisons;

  const latestWinner =
    comparisons[0]?.winner ?? "No winner yet";

  return (
    <div className="mx-auto max-w-[1700px]">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Prompt A/B Testing
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            A/B comparisons
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Review stored prompt-comparison reports, inspect
            score deltas, and identify whether prompt changes
            produced valid quality improvements.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshComparisons}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh comparisons
        </button>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Comparisons"
          value={comparisons.length.toString()}
          helper="Stored prompt A/B reports"
          icon={GitCompare}
        />

        <MetricCard
          label="Valid comparisons"
          value={validComparisons.toString()}
          helper={`${fallbackAffected} fallback-affected`}
          icon={CheckCircle2}
        />

        <MetricCard
          label="Latest winner"
          value={formatWinner(latestWinner)}
          helper="Based on stored scoring rules"
          icon={Trophy}
        />
      </section>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-950">
              Stored prompt-comparison history
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Each comparison runs the same regression dataset with
              two prompt versions and compares quality metrics.
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-500">
            {comparisons.length} comparison
            {comparisons.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
            <div>
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-indigo-600" />

              <p className="mt-4 text-sm font-semibold text-slate-700">
                Loading prompt comparisons...
              </p>
            </div>
          </div>
        ) : comparisons.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <BarChart3 className="mx-auto h-10 w-10 text-slate-300" />

              <h4 className="mt-4 font-semibold text-slate-800">
                No comparisons yet
              </h4>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Run a prompt A/B comparison from the backend to
                populate this workspace.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 p-5">
            {comparisons.map((comparison) => (
              <ComparisonCard
                key={comparison.comparison_id}
                comparison={comparison}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface ComparisonCardProps {
  comparison: PromptComparison;
}

function ComparisonCard({
  comparison,
}: ComparisonCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {comparison.comparison_valid ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Valid comparison
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" />
                Fallback affected
              </span>
            )}

            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
              {formatDate(comparison.created_at)}
            </span>
          </div>

          <h4 className="mt-3 text-lg font-bold text-slate-950">
            {comparison.prompt_version_a_name}
            <span className="mx-2 text-slate-400">vs.</span>
            {comparison.prompt_version_b_name}
          </h4>

          <p className="mt-2 text-sm text-slate-500">
            Dataset: {comparison.dataset_name}
          </p>

          <p className="mt-2 max-w-3xl font-mono text-[11px] text-slate-400">
            Comparison ID: {comparison.comparison_id}
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-800">
          <p className="text-xs font-bold uppercase tracking-wide">
            Winner
          </p>

          <p className="mt-2 text-sm font-bold">
            {formatWinner(comparison.winner)}
          </p>
        </div>
      </div>

      {comparison.comparison_warning && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {comparison.comparison_warning}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <PromptScoreCard
          label="Prompt A"
          promptName={comparison.prompt_version_a_name}
          score={comparison.score_a}
          runId={comparison.run_a_id}
        />

        <PromptScoreCard
          label="Prompt B"
          promptName={comparison.prompt_version_b_name}
          score={comparison.score_b}
          runId={comparison.run_b_id}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Metric deltas: Prompt B minus Prompt A
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <DeltaMetric
            label="Pass rate"
            value={formatDelta(
              comparison.metric_deltas_b_minus_a.pass_rate,
            )}
            rawValue={
              comparison.metric_deltas_b_minus_a.pass_rate
            }
          />

          <DeltaMetric
            label="Answer"
            value={formatDelta(
              comparison.metric_deltas_b_minus_a.avg_answer_score,
            )}
            rawValue={
              comparison.metric_deltas_b_minus_a.avg_answer_score
            }
          />

          <DeltaMetric
            label="Retrieval"
            value={formatDelta(
              comparison.metric_deltas_b_minus_a
                .avg_retrieval_score,
            )}
            rawValue={
              comparison.metric_deltas_b_minus_a
                .avg_retrieval_score
            }
          />

          <DeltaMetric
            label="Citations"
            value={formatDelta(
              comparison.metric_deltas_b_minus_a
                .avg_citation_coverage,
            )}
            rawValue={
              comparison.metric_deltas_b_minus_a
                .avg_citation_coverage
            }
          />

          <DeltaMetric
            label="Grounding"
            value={formatDelta(
              comparison.metric_deltas_b_minus_a
                .avg_grounding_score,
            )}
            rawValue={
              comparison.metric_deltas_b_minus_a
                .avg_grounding_score
            }
          />

          <DeltaMetric
            label="Latency"
            value={formatLatencyDelta(
              comparison.metric_deltas_b_minus_a
                .avg_latency_ms,
            )}
            rawValue={
              -comparison.metric_deltas_b_minus_a
                .avg_latency_ms
            }
          />
        </div>
      </div>
    </article>
  );
}

interface PromptScoreCardProps {
  label: string;
  promptName: string;
  score: number;
  runId: string;
}

function PromptScoreCard({
  label,
  promptName,
  score,
  runId,
}: PromptScoreCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <h5 className="mt-2 font-bold text-slate-950">
        {promptName}
      </h5>

      <p className="mt-3 text-3xl font-bold text-slate-950">
        {formatScore(score)}
      </p>

      <p className="mt-3 truncate font-mono text-[11px] text-slate-400">
        Run ID: {runId}
      </p>
    </div>
  );
}

interface DeltaMetricProps {
  label: string;
  value: string;
  rawValue: number;
}

function DeltaMetric({
  label,
  value,
  rawValue,
}: DeltaMetricProps) {
  const positive = rawValue > 0;
  const negative = rawValue < 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <div className="mt-2 flex items-center gap-1.5">
        {positive && (
          <ArrowUp className="h-3.5 w-3.5 text-emerald-600" />
        )}

        {negative && (
          <ArrowDown className="h-3.5 w-3.5 text-rose-600" />
        )}

        <p
          className={`font-semibold ${
            positive
              ? "text-emerald-700"
              : negative
                ? "text-rose-700"
                : "text-slate-700"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  icon: typeof GitCompare;
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            {helper}
          </p>
        </div>

        <div className="shrink-0 rounded-xl bg-indigo-50 p-3 text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}
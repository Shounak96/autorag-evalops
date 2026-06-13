"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileCheck2,
  Gauge,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getEvaluationRunResults,
  listEvaluationRuns,
} from "@/lib/evaluation-runs-api";
import type {
  EvalRun,
  EvalRunResult,
} from "@/lib/types";

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatLatency(value: number): string {
  if (value < 1000) {
    return `${value.toFixed(0)} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function promptName(run: EvalRun): string {
  return run.prompt_version_name ?? "Built-in prompt";
}

export function EvaluationRunsWorkspace() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedRunId, setExpandedRunId] =
  useState<string | null>(null);

const [runResultsById, setRunResultsById] = useState<
  Record<string, EvalRunResult[]>
>({});

const [loadingRunResultsId, setLoadingRunResultsId] =
  useState<string | null>(null);

  const refreshRuns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listEvaluationRuns();

      setRuns(response.runs);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load evaluation runs.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

    useEffect(() => {
    let cancelled = false;

    listEvaluationRuns()
      .then((response) => {
        if (!cancelled) {
          setRuns(response.runs);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load evaluation runs.",
          );
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

  async function toggleRunDetails(run: EvalRun) {
  if (expandedRunId === run.rag_run_id) {
    setExpandedRunId(null);
    return;
  }

  setExpandedRunId(run.rag_run_id);

  if (runResultsById[run.rag_run_id]) {
    return;
  }

  setLoadingRunResultsId(run.rag_run_id);
  setError(null);

  try {
    const response = await getEvaluationRunResults(
      run.rag_run_id,
    );

    setRunResultsById((currentResults) => ({
      ...currentResults,
      [run.rag_run_id]: response.results,
    }));
  } catch (requestError) {
    setError(
      requestError instanceof Error
        ? requestError.message
        : "Unable to load evaluation-run results.",
    );
  } finally {
    setLoadingRunResultsId(null);
  }
}

  const passedRuns = runs.filter(
    (run) => run.quality_gate_passed,
  ).length;

  const failedRuns = runs.length - passedRuns;

  const averagePassRate =
    runs.length === 0
      ? 0
      : runs.reduce(
          (sum, run) => sum + run.pass_rate,
          0,
        ) / runs.length;

  const averageLatency =
    runs.length === 0
      ? 0
      : runs.reduce(
          (sum, run) => sum + run.avg_latency_ms,
          0,
        ) / runs.length;

  return (
    <div className="mx-auto max-w-[1700px]">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Regression Evaluation History
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Evaluation runs
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Review historical dataset executions, compare quality-gate
            outcomes, and monitor grounding, citation coverage, and
            latency across RAG pipeline changes.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshRuns}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh runs
        </button>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Evaluation runs"
          value={runs.length.toString()}
          helper="Historical dataset executions"
          icon={Activity}
        />

        <MetricCard
          label="Quality gates passed"
          value={passedRuns.toString()}
          helper={`${failedRuns} failed run${
            failedRuns === 1 ? "" : "s"
          }`}
          icon={ShieldCheck}
        />

        <MetricCard
          label="Average pass rate"
          value={formatPercentage(averagePassRate)}
          helper="Across loaded evaluation runs"
          icon={FileCheck2}
        />

        <MetricCard
          label="Average latency"
          value={formatLatency(averageLatency)}
          helper="Per dataset test case"
          icon={Clock3}
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
              Historical quality-gate executions
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Dataset-level metrics captured after each regression run.
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-500">
            {runs.length} run{runs.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
            <div>
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-indigo-600" />

              <p className="mt-4 text-sm font-semibold text-slate-700">
                Loading evaluation history...
              </p>
            </div>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <Gauge className="mx-auto h-10 w-10 text-slate-300" />

              <h4 className="mt-4 font-semibold text-slate-800">
                No evaluation runs yet
              </h4>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Execute a saved regression dataset to populate
                historical quality-gate results.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3">Dataset</th>
                  <th className="px-5 py-3">Prompt</th>
                  <th className="px-5 py-3">Gate</th>
                  <th className="px-5 py-3">Pass rate</th>
                  <th className="px-5 py-3">Grounding</th>
                  <th className="px-5 py-3">Citations</th>
                  <th className="px-5 py-3">Unsupported</th>
                  <th className="px-5 py-3">Latency</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>

              {runs.map((run) => {
                const expanded = expandedRunId === run.rag_run_id;
                const runResults = runResultsById[run.rag_run_id] ?? [];
                const loadingDetails =
                  loadingRunResultsId === run.rag_run_id;

                return (
                  <tbody
                    key={run.rag_run_id}
                    className="divide-y divide-slate-100"
                  >
                    <tr className="text-sm text-slate-700 transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => toggleRunDetails(run)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          {expanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                          {expanded ? "Hide" : "View"}
                        </button>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {run.dataset_name ?? "Unknown dataset"}
                        </p>

                        <p className="mt-1 max-w-[190px] truncate font-mono text-[11px] text-slate-400">
                          {run.rag_run_id}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-xs">
                        {promptName(run)}
                      </td>

                      <td className="px-5 py-4">
                        {run.quality_gate_passed ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                            <XCircle className="h-3.5 w-3.5" />
                            Failed
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {formatPercentage(run.pass_rate)}
                      </td>

                      <td className="px-5 py-4">
                        {formatPercentage(run.avg_grounding_score)}
                      </td>

                      <td className="px-5 py-4">
                        {formatPercentage(run.avg_citation_coverage)}
                      </td>

                      <td className="px-5 py-4">
                        {run.total_unsupported_claims}
                      </td>

                      <td className="px-5 py-4">
                        {formatLatency(run.avg_latency_ms)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                        {formatDate(run.created_at)}
                      </td>
                    </tr>

                    {expanded && (
                      <tr>
                        <td colSpan={10} className="bg-slate-50 px-5 py-5">
                          {loadingDetails ? (
                            <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                              <LoaderCircle className="h-4 w-4 animate-spin text-indigo-600" />
                              Loading case-level results...
                            </div>
                          ) : runResults.length === 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                              No case-level results found for this run.
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {runResults.map((result, index) => (
                                <RunResultCard
                                  key={result.id}
                                  result={result}
                                  index={index}
                                />
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  icon: typeof Activity;
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
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            {helper}
          </p>
        </div>

        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

interface RunResultCardProps {
  result: EvalRunResult;
  index: number;
}

function RunResultCard({
  result,
  index,
}: RunResultCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              Case {index + 1}
            </span>

            {result.passed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Passed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                <XCircle className="h-3.5 w-3.5" />
                Failed
              </span>
            )}

            {result.required_document_hit && (
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                Required document hit
              </span>
            )}
          </div>

          <h4 className="mt-3 text-sm font-semibold text-slate-950">
            {result.question}
          </h4>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <MiniMetric
            label="Retrieval"
            value={formatPercentage(result.retrieval_score)}
          />

          <MiniMetric
            label="Grounding"
            value={formatPercentage(result.grounding_score)}
          />

          <MiniMetric
            label="Answer"
            value={formatPercentage(result.answer_score)}
          />

          <MiniMetric
            label="Latency"
            value={formatLatency(result.latency_ms)}
          />
        </div>
      </div>

      {result.failure_reasons.length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
            Failure reasons
          </p>

          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-700">
            {result.failure_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Expected answer
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-700">
            {result.expected_answer}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Generated answer
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-700">
            {result.generated_answer}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
          Citations: {formatPercentage(result.citation_coverage)}
        </span>

        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
          Unsupported claims: {result.unsupported_claims_count}
        </span>

        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
          Generation: {result.answer_generation_strategy}
        </span>

        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
          Verification: {result.verification_strategy}
        </span>
      </div>
    </article>
  );
}

interface MiniMetricProps {
  label: string;
  value: string;
}

function MiniMetric({
  label,
  value,
}: MiniMetricProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}
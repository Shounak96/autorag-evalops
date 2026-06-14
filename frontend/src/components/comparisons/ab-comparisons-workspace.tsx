"use client";

import { AlertCircle, ArrowDown, ArrowUp, BarChart3, CheckCircle2, GitCompare, LoaderCircle, RefreshCw, Trophy} from "lucide-react";
import { useEffect, useState} from "react";
import { listPromptComparisons, runPromptComparison } from "@/lib/prompt-comparisons-api";
import { listDatasets } from "@/lib/datasets-api";
import { listPrompts } from "@/lib/prompts-api";
import type { EvalDataset, PromptComparison, PromptComparisonResponse, PromptVersion} from "@/lib/types";

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

  const [datasets, setDatasets] = useState<EvalDataset[]>([]);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);

  const [selectedDatasetId, setSelectedDatasetId] =
    useState("");
  const [promptAId, setPromptAId] = useState("");
  const [promptBId, setPromptBId] = useState("");

  const [topK, setTopK] = useState(5);
  const [vectorWeight, setVectorWeight] = useState(0.7);
  const [keywordWeight, setKeywordWeight] = useState(0.3);
  const [useQueryRewrite, setUseQueryRewrite] = useState(false);
  const [maxRewrittenQueries, setMaxRewrittenQueries] =
    useState(4);

  const [runningComparison, setRunningComparison] =
    useState(false);
  const [latestComparison, setLatestComparison] =
    useState<PromptComparisonResponse | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setError(null);

      try {
        const [
          comparisonsResponse,
          datasetsResponse,
          promptsResponse,
        ] = await Promise.all([
          listPromptComparisons(),
          listDatasets(),
          listPrompts(),
        ]);

        if (cancelled) {
          return;
        }

        setComparisons(comparisonsResponse.comparisons);
        setDatasets(datasetsResponse.datasets);
        setPrompts(promptsResponse.prompts);

        setSelectedDatasetId(
          datasetsResponse.datasets[0]?.id ?? "",
        );

        const firstPrompt = promptsResponse.prompts[0]?.id ?? "";
        const secondPrompt =
          promptsResponse.prompts[1]?.id ??
          promptsResponse.prompts[0]?.id ??
          "";

        setPromptAId(firstPrompt);
        setPromptBId(secondPrompt);
      } catch (requestError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

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

    async function handleRunComparison() {
    if (!selectedDatasetId) {
      setError("Select a dataset first.");
      return;
    }

    if (!promptAId || !promptBId) {
      setError("Select both prompt versions.");
      return;
    }

    if (promptAId === promptBId) {
      setError("Prompt A and Prompt B must be different.");
      return;
    }

    setRunningComparison(true);
    setError(null);
    setSuccessMessage(null);
    setLatestComparison(null);

    try {
      const response = await runPromptComparison(
        selectedDatasetId,
        {
          prompt_version_a_id: promptAId,
          prompt_version_b_id: promptBId,
          top_k: topK,
          vector_weight: vectorWeight,
          keyword_weight: keywordWeight,
          use_query_rewrite: useQueryRewrite,
          max_rewritten_queries: maxRewrittenQueries,
          thresholds: {
            min_pass_rate: 0.8,
            min_retrieval_score: 0.2,
            min_grounding_score: 0.75,
            min_citation_coverage: 1.0,
            min_answer_score: 0.6,
            max_unsupported_claims: 0,
          },
        },
      );

      setLatestComparison(response);
      setSuccessMessage("Prompt comparison completed.");

      const comparisonsResponse = await listPromptComparisons();
      setComparisons(comparisonsResponse.comparisons);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setRunningComparison(false);
    }
  }

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

            {successMessage && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <h3 className="font-semibold text-slate-950">
              Run a new prompt comparison
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Select a dataset and two prompt versions, then run the
              same regression tests against both prompts.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunComparison}
            disabled={runningComparison}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {runningComparison ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <GitCompare className="h-4 w-4" />
            )}
            Run comparison
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <SelectField
            label="Dataset"
            value={selectedDatasetId}
            onChange={setSelectedDatasetId}
            options={datasets.map((dataset) => ({
              value: dataset.id,
              label: `${dataset.name} (${dataset.test_case_count} cases)`,
            }))}
          />

          <SelectField
            label="Prompt A"
            value={promptAId}
            onChange={setPromptAId}
            options={prompts.map((prompt) => ({
              value: prompt.id,
              label: prompt.name,
            }))}
          />

          <SelectField
            label="Prompt B"
            value={promptBId}
            onChange={setPromptBId}
            options={prompts.map((prompt) => ({
              value: prompt.id,
              label: prompt.name,
            }))}
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <NumberField
            label="Top K"
            value={topK}
            min={1}
            max={10}
            step={1}
            onChange={setTopK}
          />

          <NumberField
            label="Vector weight"
            value={vectorWeight}
            min={0}
            max={1}
            step={0.1}
            onChange={setVectorWeight}
          />

          <NumberField
            label="Keyword weight"
            value={keywordWeight}
            min={0}
            max={1}
            step={0.1}
            onChange={setKeywordWeight}
          />

          <NumberField
            label="Max rewrites"
            value={maxRewrittenQueries}
            min={1}
            max={6}
            step={1}
            onChange={setMaxRewrittenQueries}
          />

          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">
              Query rewrite
            </span>

            <input
              type="checkbox"
              checked={useQueryRewrite}
              onChange={(event) =>
                setUseQueryRewrite(event.target.checked)
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>

        {latestComparison && (
          <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
              Latest comparison result
            </p>

            <h4 className="mt-2 text-lg font-bold text-slate-950">
              Winner: {formatWinner(latestComparison.winner)}
            </h4>

            <p className="mt-2 text-sm text-slate-600">
              {latestComparison.prompt_version_a_name}:{" "}
              {formatScore(latestComparison.score_a)} ·{" "}
              {latestComparison.prompt_version_b_name}:{" "}
              {formatScore(latestComparison.score_b)}
            </p>

            {latestComparison.comparison_warning && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {latestComparison.comparison_warning}
              </p>
            )}
          </div>
        )}
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
  runId: string | null;
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
        Run ID: {runId ?? "Not available"}
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

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      >
        <option value="">Select {label.toLowerCase()}</option>

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>

      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      />
    </label>
  );
}
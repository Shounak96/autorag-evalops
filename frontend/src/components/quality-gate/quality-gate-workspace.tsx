"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import { listDatasets } from "@/lib/datasets-api";
import { listPrompts } from "@/lib/prompts-api";

import {
  getLatestQualityGateRun,
  runQualityGate,
  type QualityGateRunDetail,
} from "@/lib/quality-gate-api";

import type {
  EvalDataset,
  EvalDatasetRunSummary,
  EvalRunResult,
  PromptVersion,
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

const QUALITY_THRESHOLDS = [
  {
    label: "Minimum pass rate",
    value: "80.0%",
  },
  {
    label: "Minimum retrieval score",
    value: "20.0%",
  },
  {
    label: "Minimum grounding score",
    value: "75.0%",
  },
  {
    label: "Minimum citation coverage",
    value: "100.0%",
  },
  {
    label: "Minimum answer score",
    value: "60.0%",
  },
  {
    label: "Maximum unsupported claims",
    value: "0",
  },
];

export function QualityGateWorkspace() {
  const [qualityGateRun, setQualityGateRun] =
    useState<QualityGateRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
    const [datasets, setDatasets] = useState<EvalDataset[]>([]);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);

  const [selectedDatasetId, setSelectedDatasetId] =
    useState("");
  const [selectedPromptId, setSelectedPromptId] =
    useState("");

  const [topK, setTopK] = useState(5);
  const [vectorWeight, setVectorWeight] = useState(0.7);
  const [keywordWeight, setKeywordWeight] = useState(0.3);
  const [useQueryRewrite, setUseQueryRewrite] = useState(false);
  const [maxRewrittenQueries, setMaxRewrittenQueries] =
    useState(4);

  const [minPassRate, setMinPassRate] = useState(0.8);
  const [minRetrievalScore, setMinRetrievalScore] =
    useState(0.2);
  const [minGroundingScore, setMinGroundingScore] =
    useState(0.75);
  const [minCitationCoverage, setMinCitationCoverage] =
    useState(1.0);
  const [minAnswerScore, setMinAnswerScore] =
    useState(0.6);
  const [maxUnsupportedClaims, setMaxUnsupportedClaims] =
    useState(0);
  const [maxAvgLatencyMs, setMaxAvgLatencyMs] = useState(15000);

  const [ciGateToken, setCiGateToken] = useState("");
  const [runningGate, setRunningGate] = useState(false);
  const [manualGateRun, setManualGateRun] =
    useState<EvalDatasetRunSummary | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  async function refreshQualityGate() {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const latestRun = await getLatestQualityGateRun();

      setQualityGateRun(latestRun);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setError(null);

      try {
        const [
          latestRun,
          datasetsResponse,
          promptsResponse,
        ] = await Promise.all([
          getLatestQualityGateRun(),
          listDatasets(),
          listPrompts(),
        ]);

        if (cancelled) {
          return;
        }

        setQualityGateRun(latestRun);
        setDatasets(datasetsResponse.datasets);
        setPrompts(promptsResponse.prompts);

        setSelectedDatasetId(
          datasetsResponse.datasets[0]?.id ?? "",
        );

        const defaultPrompt =
          promptsResponse.prompts.find(
            (prompt) => prompt.is_default,
          ) ?? promptsResponse.prompts[0];

        setSelectedPromptId(defaultPrompt?.id ?? "");
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

  const deploymentAllowed =
    qualityGateRun?.quality_gate_passed ?? false;

  const failedCases =
    qualityGateRun?.results.filter((result) => !result.passed) ?? [];

    async function handleRunQualityGate() {
    if (!selectedDatasetId) {
      setError("Select a dataset first.");
      return;
    }

    setRunningGate(true);
    setError(null);
    setSuccessMessage(null);
    setManualGateRun(null);

    try {
      const result = await runQualityGate(
        selectedDatasetId,
        {
          top_k: topK,
          vector_weight: vectorWeight,
          keyword_weight: keywordWeight,
          use_query_rewrite: useQueryRewrite,
          max_rewritten_queries: maxRewrittenQueries,
          prompt_version_id: selectedPromptId || null,
          thresholds: {
            min_pass_rate: minPassRate,
            min_retrieval_score: minRetrievalScore,
            min_grounding_score: minGroundingScore,
            min_citation_coverage: minCitationCoverage,
            min_answer_score: minAnswerScore,
            max_unsupported_claims: maxUnsupportedClaims,
            max_avg_latency_ms: maxAvgLatencyMs,
          },
        },
        ciGateToken,
      );

      setManualGateRun(result);
      setSuccessMessage("Quality gate completed.");

      const latestRun = await getLatestQualityGateRun();
      setQualityGateRun(latestRun);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setRunningGate(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1700px]">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Deployment Safety Gate
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Quality gate
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Monitor whether the latest RAG regression run meets
            deployment thresholds for pass rate, grounding, citation
            coverage, answer quality, retrieval quality, and
            unsupported claims.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshQualityGate}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh gate
        </button>
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
              Run quality gate manually
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Select a dataset, prompt version, retrieval settings,
              and deployment thresholds. The backend will return a
              pass/fail deployment decision.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunQualityGate}
            disabled={runningGate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {runningGate ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Run quality gate
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
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
            label="Prompt version"
            value={selectedPromptId}
            onChange={setSelectedPromptId}
            options={prompts.map((prompt) => ({
              value: prompt.id,
              label: `${prompt.name}${prompt.is_default ? " — default" : ""}`,
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

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <NumberField
            label="Min pass rate"
            value={minPassRate}
            min={0}
            max={1}
            step={0.05}
            onChange={setMinPassRate}
          />

          <NumberField
            label="Min retrieval"
            value={minRetrievalScore}
            min={0}
            max={1}
            step={0.05}
            onChange={setMinRetrievalScore}
          />

          <NumberField
            label="Min grounding"
            value={minGroundingScore}
            min={0}
            max={1}
            step={0.05}
            onChange={setMinGroundingScore}
          />

          <NumberField
            label="Min citations"
            value={minCitationCoverage}
            min={0}
            max={1}
            step={0.05}
            onChange={setMinCitationCoverage}
          />

          <NumberField
            label="Min answer"
            value={minAnswerScore}
            min={0}
            max={1}
            step={0.05}
            onChange={setMinAnswerScore}
          />

          <NumberField
            label="Max unsupported"
            value={maxUnsupportedClaims}
            min={0}
            max={10}
            step={1}
            onChange={setMaxUnsupportedClaims}
          />

          <NumberField
            label="Max avg latency ms"
            value={maxAvgLatencyMs}
            min={1}
            max={120000}
            step={500}
            onChange={setMaxAvgLatencyMs}
          />
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Optional CI gate token
          </span>

          <input
            type="password"
            value={ciGateToken}
            onChange={(event) =>
              setCiGateToken(event.target.value)
            }
            placeholder="Leave blank for local testing if backend allows it"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
        </label>

        {manualGateRun && (
          <div
            className={`mt-5 rounded-2xl border p-4 ${
              manualGateRun.quality_gate_passed
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50"
            }`}
          >
            <p
              className={`text-xs font-bold uppercase tracking-wide ${
                manualGateRun.quality_gate_passed
                  ? "text-emerald-700"
                  : "text-rose-700"
              }`}
            >
              Manual quality-gate result
            </p>

            <h4 className="mt-2 text-lg font-bold text-slate-950">
              {manualGateRun.quality_gate_passed
                ? "Deployment allowed"
                : "Deployment blocked"}
            </h4>

            <p className="mt-2 text-sm text-slate-600">
              {manualGateRun.passed_cases}/
              {manualGateRun.total_cases} cases passed · Pass
              rate {formatPercentage(manualGateRun.pass_rate)} ·
              Unsupported claims{" "}
              {manualGateRun.total_unsupported_claims}
            </p>

            <p className="mt-2 font-mono text-[11px] text-slate-500">
              Run ID: {manualGateRun.rag_run_id}
            </p>
          </div>
        )}
      </section>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div>
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-indigo-600" />

            <p className="mt-4 text-sm font-semibold text-slate-700">
              Loading latest quality gate...
            </p>
          </div>
        </div>
      ) : !qualityGateRun ? (
        <div className="mt-8 flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="max-w-sm">
            <Gauge className="mx-auto h-10 w-10 text-slate-300" />

            <h3 className="mt-4 font-semibold text-slate-800">
              No quality-gate runs yet
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Run a regression dataset or CI quality gate to populate
              deployment readiness data.
            </p>
          </div>
        </div>
      ) : (
        <>
          <section
            className={`mt-8 rounded-3xl border p-6 shadow-sm ${
              deploymentAllowed
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50"
            }`}
          >
            <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
              <div className="flex items-start gap-4">
                <div
                  className={`rounded-2xl p-4 ${
                    deploymentAllowed
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {deploymentAllowed ? (
                    <ShieldCheck className="h-8 w-8" />
                  ) : (
                    <ShieldAlert className="h-8 w-8" />
                  )}
                </div>

                <div>
                  <p
                    className={`text-sm font-bold uppercase tracking-wide ${
                      deploymentAllowed
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }`}
                  >
                    {deploymentAllowed
                      ? "Deployment allowed"
                      : "Deployment blocked"}
                  </p>

                  <h3 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    {deploymentAllowed
                      ? "Latest RAG quality gate passed"
                      : "Latest RAG quality gate failed"}
                  </h3>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    Dataset: {qualityGateRun.dataset_name} · Prompt:{" "}
                    {qualityGateRun.prompt_version_name ??
                      "Built-in prompt"}{" "}
                    · Created {formatDate(qualityGateRun.created_at)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  CI decision
                </p>

                <p className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-950">
                  <Rocket className="h-5 w-5 text-indigo-600" />
                  {deploymentAllowed
                    ? "Release may continue"
                    : "Release must be stopped"}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Pass rate"
              value={formatPercentage(qualityGateRun.pass_rate)}
              helper={`${qualityGateRun.passed_cases}/${qualityGateRun.total_cases} cases passed`}
              icon={FileCheck2}
            />

            <MetricCard
              label="Grounding"
              value={formatPercentage(
                qualityGateRun.avg_grounding_score,
              )}
              helper="Evidence-backed claims"
              icon={ShieldCheck}
            />

            <MetricCard
              label="Citation coverage"
              value={formatPercentage(
                qualityGateRun.avg_citation_coverage,
              )}
              helper="Required citations present"
              icon={CheckCircle2}
            />

            <MetricCard
              label="Unsupported claims"
              value={qualityGateRun.total_unsupported_claims.toString()}
              helper="Must remain zero"
              icon={ShieldAlert}
            />

            <MetricCard
              label="Avg latency"
              value={formatLatency(qualityGateRun.avg_latency_ms)}
              helper="Per evaluation case"
              icon={Clock3}
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-950">
                Gate thresholds
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Current deployment thresholds used by the local CI
                quality-gate runner.
              </p>

              <div className="mt-5 space-y-3">
                {QUALITY_THRESHOLDS.map((threshold) => (
                  <div
                    key={threshold.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <span className="text-xs font-semibold text-slate-500">
                      {threshold.label}
                    </span>

                    <span className="text-sm font-bold text-slate-900">
                      {threshold.value}
                    </span>
                  </div>
                ))}
              </div>
            </aside>

            <main className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-semibold text-slate-950">
                    Case-level gate results
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Individual test cases and failure reasons from
                    the latest run.
                  </p>
                </div>

                <span className="text-xs font-semibold text-slate-500">
                  {failedCases.length} failed case
                  {failedCases.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {qualityGateRun.results.map((result, index) => (
                  <QualityCaseRow
                    key={result.id}
                    result={result}
                    index={index}
                  />
                ))}
              </div>
            </main>
          </section>
        </>
      )}
    </div>
  );
}

interface QualityCaseRowProps {
  result: EvalRunResult;
  index: number;
}

function QualityCaseRow({
  result,
  index,
}: QualityCaseRowProps) {
  return (
    <article className="p-5">
      <div className="flex flex-col justify-between gap-4 2xl:flex-row 2xl:items-start">
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
          </div>

          <h4 className="mt-3 text-sm font-semibold text-slate-950">
            {result.question}
          </h4>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {result.generated_answer}
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 text-xs sm:grid-cols-4 2xl:min-w-[420px]">
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

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  icon: typeof FileCheck2;
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
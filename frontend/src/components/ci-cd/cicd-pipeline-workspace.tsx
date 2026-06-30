"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FileJson,
  GitBranch,
  KeyRound,
  Rocket,
  ShieldCheck,
  Terminal,
  XCircle,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

import { listCiCdRuns, splitRunsBySource } from "@/lib/ci-cd-api";
import type { EvalDataset, EvalRun, PromptVersion } from "@/lib/types";
import { listDatasets } from "@/lib/datasets-api";
import { listPrompts } from "@/lib/prompts-api";

const LOCAL_COMMAND = `python scripts\\run_ci_quality_gate.py`;

const LOCAL_ENVIRONMENT = `$env:AUTORAG_API_BASE_URL = "http://127.0.0.1:8000"
$env:AUTORAG_DATASET_ID = "3123162a-4427-49f9-9116-afecb2743196"
$env:AUTORAG_PROMPT_VERSION_ID = "973132c5-0e64-46ed-b874-dca745f77609"
$env:AUTORAG_USE_QUERY_REWRITE = "false"
$env:AUTORAG_CI_GATE_TOKEN = "your-local-token"`;

const GITHUB_ACTIONS_YAML = `name: AutoRAG Quality Gate

on:
  pull_request:
  workflow_dispatch:

jobs:
  rag-quality-gate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install CI dependencies
        run: |
          python -m pip install --upgrade pip
          pip install requests

      - name: Run AutoRAG quality gate
        env:
          AUTORAG_API_BASE_URL: \${{ vars.AUTORAG_API_BASE_URL }}
          AUTORAG_DATASET_ID: \${{ vars.AUTORAG_DATASET_ID }}
          AUTORAG_PROMPT_VERSION_ID: \${{ vars.AUTORAG_PROMPT_VERSION_ID }}
          AUTORAG_CI_GATE_TOKEN: \${{ secrets.AUTORAG_CI_GATE_TOKEN }}
          AUTORAG_USE_QUERY_REWRITE: "false"
        run: python scripts/run_ci_quality_gate.py

      - name: Upload quality-gate report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ci-quality-gate-report
          path: artifacts/ci-quality-gate-report.json`;

const REPORT_PATH = `artifacts\\ci-quality-gate-report.json`;

function copyToClipboard(
  text: string,
  setCopiedLabel: (label: string | null) => void,
  label: string,
) {
  navigator.clipboard.writeText(text);
  setCopiedLabel(label);

  window.setTimeout(() => {
    setCopiedLabel(null);
  }, 2200);
}

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

function shortCommit(commitSha: string | null): string {
  if (!commitSha) {
    return "Not available";
  }

  return commitSha.slice(0, 7);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export function CICDPipelineWorkspace() {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(
    null,
  );

const [runs, setRuns] = useState<EvalRun[]>([]);
const [loadingRuns, setLoadingRuns] = useState(true);
const [runsError, setRunsError] = useState<string | null>(null);
const [datasets, setDatasets] = useState<EvalDataset[]>([]);
const [prompts, setPrompts] = useState<PromptVersion[]>([]);
const [selectedDatasetId, setSelectedDatasetId] = useState("");
const [selectedPromptId, setSelectedPromptId] = useState("");

async function refreshRuns() {
  setLoadingRuns(true);
  setRunsError(null);

  try {
    const response = await listCiCdRuns(50);
    setRuns(response);
    const [datasetsResponse, promptsResponse] = await Promise.all([
    listDatasets(),
    listPrompts(),
  ]);

  setDatasets(datasetsResponse.datasets);
  setPrompts(promptsResponse.prompts);

  setSelectedDatasetId((currentValue) =>
    currentValue || datasetsResponse.datasets[0]?.id || "",
  );

  const defaultPrompt =
    promptsResponse.prompts.find((prompt) => prompt.is_default) ??
    promptsResponse.prompts[0];

  setSelectedPromptId((currentValue) =>
    currentValue || defaultPrompt?.id || "",
  );
    } catch (requestError) {
      setRunsError(getErrorMessage(requestError));
    } finally {
      setLoadingRuns(false);
    }
  }

  useEffect(() => {
  let cancelled = false;

  async function loadInitialRuns() {
    setLoadingRuns(true);
    setRunsError(null);

    try {
      const response = await listCiCdRuns(50);

      const [datasetsResponse, promptsResponse] = await Promise.all([
        listDatasets(),
        listPrompts(),
      ]);

      if (cancelled) {
        return;
      }

      setRuns(response);
      setDatasets(datasetsResponse.datasets);
      setPrompts(promptsResponse.prompts);

      setSelectedDatasetId((currentValue) =>
        currentValue || datasetsResponse.datasets[0]?.id || "",
      );

      const defaultPrompt =
        promptsResponse.prompts.find((prompt) => prompt.is_default) ??
        promptsResponse.prompts[0];

      setSelectedPromptId((currentValue) =>
        currentValue || defaultPrompt?.id || "",
      );
    } catch (requestError) {
      if (!cancelled) {
        setRunsError(getErrorMessage(requestError));
      }
    } finally {
      if (!cancelled) {
        setLoadingRuns(false);
      }
    }
  }

  loadInitialRuns();

  return () => {
    cancelled = true;
  };
}, []);

  const { ciRuns, manualRuns } = splitRunsBySource(runs);
  const latestCiRun = ciRuns[0] ?? null;
  const latestAnyRun = runs[0] ?? null;
  const selectedDataset = datasets.find(
  (dataset) => dataset.id === selectedDatasetId,
  );

  const selectedPrompt = prompts.find(
    (prompt) => prompt.id === selectedPromptId,
  );

  const githubVariables = `AUTORAG_API_BASE_URL=<your-deployed-backend-url>
  AUTORAG_DATASET_ID=${selectedDatasetId || "<select-a-dataset>"}
  AUTORAG_PROMPT_VERSION_ID=${selectedPromptId || "<select-a-prompt>"}`;

  const localEnvironment = `$env:AUTORAG_API_BASE_URL = "http://127.0.0.1:8000"
  $env:AUTORAG_DATASET_ID = "${selectedDatasetId || "<select-a-dataset>"}"
  $env:AUTORAG_PROMPT_VERSION_ID = "${selectedPromptId || "<select-a-prompt>"}"
  $env:AUTORAG_USE_QUERY_REWRITE = "false"
  $env:AUTORAG_CI_GATE_TOKEN = "your-local-token"`;

  return (
    <div className="mx-auto max-w-[1700px]">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Deployment Automation
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            CI/CD pipeline
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Connect AutoRAG EvalOps to a deployment workflow so
            pull requests and releases are blocked when RAG quality
            drops below configured thresholds.
          </p>
        </div>

        {copiedLabel && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {copiedLabel} copied
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <p className="text-sm font-semibold text-indigo-600">
              Live CI/CD Monitoring
            </p>

            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Pipeline run history
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Track manual quality-gate runs and automated GitHub Actions
              runs using the same evaluation history endpoint.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshRuns}
            disabled={loadingRuns}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {loadingRuns ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh runs
          </button>
        </div>

        {runsError && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {runsError}
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total runs"
            value={String(runs.length)}
            helper="Manual and CI quality-gate runs"
            icon={FileJson}
          />

          <MetricCard
            label="CI runs"
            value={String(ciRuns.length)}
            helper="Runs triggered by GitHub Actions"
            icon={GitBranch}
          />

          <MetricCard
            label="Manual runs"
            value={String(manualRuns.length)}
            helper="Runs triggered from AutoRAG UI"
            icon={Terminal}
          />

          <MetricCard
            label="Latest status"
            value={
              latestAnyRun
                ? latestAnyRun.quality_gate_passed
                  ? "Passed"
                  : "Failed"
                : "No runs"
            }
            helper={
              latestAnyRun
                ? `${latestAnyRun.passed_cases}/${latestAnyRun.total_cases} cases passed`
                : "No evaluation history yet"
            }
            icon={latestAnyRun?.quality_gate_passed ? CheckCircle2 : XCircle}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <RunHistoryPanel
            title="Latest automated CI run"
            emptyText="No GitHub Actions CI runs have been recorded yet. After backend deployment and repository variables are configured, CI runs will appear here."
            run={latestCiRun}
          />

          <RunHistoryPanel
            title="Latest manual gate run"
            emptyText="No manual quality-gate runs found."
            run={manualRuns[0] ?? null}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <p className="text-sm font-semibold text-indigo-600">
              CI/CD Configuration Helper
            </p>

            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Generate setup values
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Select the dataset and prompt version that GitHub Actions
              should use for automated RAG quality checks.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SelectField
            label="Regression dataset"
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

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <CodePanel
            title="GitHub repository variables"
            description="Add these in GitHub → Settings → Secrets and variables → Actions → Variables."
            code={githubVariables}
            copyLabel="GitHub variables"
            onCopy={() =>
              copyToClipboard(
                githubVariables,
                setCopiedLabel,
                "GitHub variables",
              )
            }
          />

          <CodePanel
            title="Local PowerShell environment"
            description="Use these values to test the CI runner locally while FastAPI is running."
            code={localEnvironment}
            copyLabel="Local environment"
            onCopy={() =>
              copyToClipboard(
                localEnvironment,
                setCopiedLabel,
                "Local environment",
              )
            }
          />
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Selected CI target
          </p>

          <p className="mt-2 text-sm font-semibold text-slate-950">
            Dataset: {selectedDataset?.name ?? "Not selected"}
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Prompt: {selectedPrompt?.name ?? "Not selected"}
          </p>
        </div>
      </section>


      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gate behavior"
          value="Blocking"
          helper="Failed quality gate stops deployment"
          icon={ShieldCheck}
        />

        <MetricCard
          label="Execution mode"
          value="API-driven"
          helper="CI calls the FastAPI quality-gate endpoint"
          icon={Terminal}
        />

        <MetricCard
          label="Report output"
          value="JSON artifact"
          helper="Saved for debugging and review"
          icon={FileJson}
        />

        <MetricCard
          label="Workflow target"
          value="GitHub Actions"
          helper="Configured after backend deployment"
          icon={GitBranch}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="space-y-6">
          <InfoPanel
            title="How the CI quality gate works"
            icon={GitBranch}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FlowStep
                number="1"
                title="Run regression dataset"
                description="The CI runner calls the backend quality-gate endpoint with a dataset ID and prompt version."
              />

              <FlowStep
                number="2"
                title="Evaluate RAG quality"
                description="The backend checks pass rate, retrieval score, grounding, citations, answer quality, and unsupported claims."
              />

              <FlowStep
                number="3"
                title="Allow or block release"
                description="If the quality gate passes, deployment continues. If it fails, the script exits with code 1."
              />
            </div>
          </InfoPanel>

          <CodePanel
            title="Local quality-gate command"
            description="Use this command from the project root while FastAPI is running locally."
            code={LOCAL_COMMAND}
            copyLabel="Command"
            onCopy={() =>
              copyToClipboard(
                LOCAL_COMMAND,
                setCopiedLabel,
                "Command",
              )
            }
          />

          <CodePanel
            title="Local PowerShell environment"
            description="These values configure the local CI runner. Never commit real tokens."
            code={LOCAL_ENVIRONMENT}
            copyLabel="Environment"
            onCopy={() =>
              copyToClipboard(
                LOCAL_ENVIRONMENT,
                setCopiedLabel,
                "Environment",
              )
            }
          />

          <CodePanel
            title="GitHub Actions workflow"
            description="This workflow will be activated after deploying the backend and adding repository variables/secrets."
            code={GITHUB_ACTIONS_YAML}
            copyLabel="Workflow YAML"
            onCopy={() =>
              copyToClipboard(
                GITHUB_ACTIONS_YAML,
                setCopiedLabel,
                "Workflow YAML",
              )
            }
          />
        </main>

        <aside className="space-y-6">
          <InfoPanel
            title="Required GitHub configuration"
            icon={KeyRound}
          >
            <div className="space-y-3">
              <ConfigRow
                label="Repository variable"
                value="AUTORAG_API_BASE_URL"
              />

              <ConfigRow
                label="Repository variable"
                value="AUTORAG_DATASET_ID"
              />

              <ConfigRow
                label="Repository variable"
                value="AUTORAG_PROMPT_VERSION_ID"
              />

              <ConfigRow
                label="Repository secret"
                value="AUTORAG_CI_GATE_TOKEN"
              />
            </div>
          </InfoPanel>

          <InfoPanel
            title="Deployment decision states"
            icon={Rocket}
          >
            <div className="space-y-4">
              <DecisionState
                variant="pass"
                title="Quality gate passed"
                description="The script exits with code 0 and deployment may continue."
              />

              <DecisionState
                variant="fail"
                title="Quality gate failed"
                description="The script exits with code 1 and deployment must be blocked."
              />

              <DecisionState
                variant="warning"
                title="Fallback affected"
                description="The system can still evaluate safely, but prompt-only comparisons should be marked carefully."
              />
            </div>
          </InfoPanel>

          <InfoPanel
            title="Generated report"
            icon={FileJson}
          >
            <p className="text-sm leading-6 text-slate-500">
              Every CI run saves a machine-readable quality report:
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-slate-100">
              {REPORT_PATH}
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-500">
              This report is useful for reviewing failed cases,
              metric thresholds, and deployment-blocking reasons.
            </p>
          </InfoPanel>
        </aside>
      </section>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  icon: typeof ShieldCheck;
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

interface InfoPanelProps {
  title: string;
  icon: typeof GitBranch;
  children: React.ReactNode;
}

function InfoPanel({
  title,
  icon: Icon,
  children,
}: InfoPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>

        <h3 className="font-semibold text-slate-950">
          {title}
        </h3>
      </div>

      {children}
    </section>
  );
}

interface FlowStepProps {
  number: string;
  title: string;
  description: string;
}

function FlowStep({
  number,
  title,
  description,
}: FlowStepProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
        {number}
      </div>

      <h4 className="mt-4 font-semibold text-slate-950">
        {title}
      </h4>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

interface CodePanelProps {
  title: string;
  description: string;
  code: string;
  copyLabel: string;
  onCopy: () => void;
}

function CodePanel({
  title,
  description,
  code,
  copyLabel,
  onCopy,
}: CodePanelProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold text-slate-950">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Clipboard className="h-3.5 w-3.5" />
          Copy {copyLabel}
        </button>
      </div>

      <pre className="overflow-x-auto bg-slate-950 p-5 text-xs leading-6 text-slate-100">
        <code>{code}</code>
      </pre>
    </section>
  );
}

interface ConfigRowProps {
  label: string;
  value: string;
}

function ConfigRow({
  label,
  value,
}: ConfigRowProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

interface DecisionStateProps {
  variant: "pass" | "fail" | "warning";
  title: string;
  description: string;
}

function DecisionState({
  variant,
  title,
  description,
}: DecisionStateProps) {
  const config = {
    pass: {
      icon: CheckCircle2,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    fail: {
      icon: XCircle,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    },
    warning: {
      icon: AlertTriangle,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
  }[variant];

  const Icon = config.icon;

  return (
    <div
      className={`rounded-xl border p-4 ${config.className}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />

        <div>
          <p className="text-sm font-bold">{title}</p>

          <p className="mt-1 text-xs leading-5">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

interface RunHistoryPanelProps {
  title: string;
  emptyText: string;
  run: EvalRun | null;
}

function RunHistoryPanel({
  title,
  emptyText,
  run,
}: RunHistoryPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-950">
          {title}
        </h3>

        {run && (
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              run.quality_gate_passed
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {run.quality_gate_passed ? "Passed" : "Failed"}
          </span>
        )}
      </div>

      {!run ? (
        <p className="mt-4 text-sm leading-6 text-slate-500">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {run.dataset_name ?? "Unknown dataset"}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Prompt: {run.prompt_version_name ?? "Default prompt"}
            </p>

            <p className="mt-1 font-mono text-[11px] text-slate-400">
              Run ID: {run.rag_run_id}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <RunMeta label="Source" value={run.source ?? "manual"} />
            <RunMeta label="Trigger" value={run.trigger_type ?? "manual"} />
            <RunMeta label="Branch" value={run.branch_name ?? "Not available"} />
            <RunMeta label="Commit" value={shortCommit(run.commit_sha)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <RunMeta
              label="Pass rate"
              value={formatPercentage(run.pass_rate)}
            />

            <RunMeta
              label="Grounding"
              value={formatPercentage(run.avg_grounding_score)}
            />

            <RunMeta
              label="Latency"
              value={formatLatency(run.avg_latency_ms)}
            />
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Created {formatDate(run.created_at)}
          </p>

          {run.external_run_url && (
            <a
              href={run.external_run_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
            >
              <Rocket className="h-3.5 w-3.5" />
              Open GitHub Actions run
            </a>
          )}
        </div>
      )}
    </section>
  );
}

interface RunMetaProps {
  label: string;
  value: string;
}

function RunMeta({
  label,
  value,
}: RunMetaProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-all text-xs font-semibold text-slate-800">
        {value}
      </p>
    </div>
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
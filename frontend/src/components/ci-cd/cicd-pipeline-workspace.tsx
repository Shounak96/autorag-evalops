"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Code2,
  FileJson,
  GitBranch,
  KeyRound,
  Rocket,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react";
import { useState } from "react";

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

export function CICDPipelineWorkspace() {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(
    null,
  );

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
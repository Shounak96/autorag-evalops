"use client";

import {
  AlertCircle,
  CheckCircle2,
  Copy,
  FileText,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import {
  listPrompts,
  setDefaultPrompt,
} from "@/lib/prompts-api";
import type { PromptVersion } from "@/lib/types";

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function truncateText(
  text: string,
  maxLength: number,
): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export function PromptVersionsWorkspace() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPromptId, setUpdatingPromptId] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  async function refreshPrompts() {
    setLoading(true);
    setError(null);

    try {
      const response = await listPrompts();

      setPrompts(response.prompts);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    listPrompts()
      .then((response) => {
        if (!cancelled) {
          setPrompts(response.prompts);
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

  async function handleSetDefault(prompt: PromptVersion) {
    if (prompt.is_default) {
      return;
    }

    setUpdatingPromptId(prompt.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await setDefaultPrompt(prompt.id);

      setSuccessMessage(
        `${prompt.name} is now the default prompt version.`,
      );

      await refreshPrompts();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setUpdatingPromptId(null);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);

    setSuccessMessage("Prompt text copied to clipboard.");
  }

  const defaultPrompt = prompts.find(
    (prompt) => prompt.is_default,
  );

  return (
    <div className="mx-auto max-w-[1700px]">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Prompt Engineering Workspace
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Prompt versions
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Manage citation-first answer prompts, compare strict and
            balanced response strategies, and control the default
            prompt used by RAG evaluations.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshPrompts}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh prompts
        </button>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Prompt versions"
          value={prompts.length.toString()}
          helper="Configured generation prompts"
          icon={FileText}
        />

        <MetricCard
          label="Default prompt"
          value={defaultPrompt?.name ?? "None"}
          helper="Used when no prompt is selected"
          icon={Star}
        />

        <MetricCard
          label="Prompt mode"
          value="Citation-first"
          helper="Designed for grounded RAG answers"
          icon={ShieldCheck}
        />
      </section>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-950">
              Saved prompt versions
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Versioned prompts used during answer generation and
              prompt A/B comparisons.
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-500">
            {prompts.length} prompt
            {prompts.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
            <div>
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-indigo-600" />

              <p className="mt-4 text-sm font-semibold text-slate-700">
                Loading prompt versions...
              </p>
            </div>
          </div>
        ) : prompts.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <Sparkles className="mx-auto h-10 w-10 text-slate-300" />

              <h4 className="mt-4 font-semibold text-slate-800">
                No prompt versions yet
              </h4>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Create prompt versions from the backend to compare
                generation behavior across RAG evaluations.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 p-5 xl:grid-cols-2">
            {prompts.map((prompt) => (
              <article
                key={prompt.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-bold text-slate-950">
                        {prompt.name}
                      </h4>

                      {prompt.is_default && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <Star className="h-3.5 w-3.5" />
                          Default
                        </span>
                      )}
                    </div>

                    {prompt.description && (
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {prompt.description}
                      </p>
                    )}

                    <p className="mt-3 text-xs text-slate-400">
                      Created {formatDate(prompt.created_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSetDefault(prompt)}
                    disabled={
                      prompt.is_default ||
                      updatingPromptId === prompt.id
                    }
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-400"
                  >
                    {updatingPromptId === prompt.id ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Star className="h-3.5 w-3.5" />
                    )}

                    {prompt.is_default
                      ? "Default"
                      : "Set default"}
                  </button>
                </div>

                <div className="mt-5 grid gap-4">
                  <PromptBlock
                    label="System prompt"
                    text={prompt.system_prompt}
                    onCopy={() =>
                      handleCopy(prompt.system_prompt)
                    }
                  />

                  <PromptBlock
                    label="User prompt template"
                    text={prompt.user_prompt_template}
                    onCopy={() =>
                      handleCopy(prompt.user_prompt_template)
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface PromptBlockProps {
  label: string;
  text: string;
  onCopy: () => void;
}

function PromptBlock({
  label,
  text,
  onCopy,
}: PromptBlockProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {label}
        </p>

        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </button>
      </div>

      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 font-mono text-xs leading-6 text-slate-100">
        {truncateText(text, 700)}
      </p>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  icon: typeof FileText;
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
"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpenText,
  BrainCircuit,
  ChevronDown,
  Clock3,
  FileText,
  Gauge,
  LoaderCircle,
  Network,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { apiPost } from "@/lib/api";
import type {
  PromptVersion,
  RagAskRequest,
  RagAskResponse,
} from "@/lib/types";

interface RagPlaygroundProps {
  prompts: PromptVersion[];
}

const DEFAULT_QUESTION =
  "What quality metrics does AutoRAG EvalOps evaluate before deployment?";

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatLatency(value: number): string {
  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function verificationVariant(
  status: string,
): "success" | "warning" | "neutral" {
  if (status === "supported") {
    return "success";
  }

  if (status === "unsupported") {
    return "warning";
  }

  return "neutral";
}

export function RagPlayground({
  prompts,
}: RagPlaygroundProps) {
  const defaultPrompt =
    prompts.find((prompt) => prompt.is_default) ?? null;

  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [promptVersionId, setPromptVersionId] = useState(
    defaultPrompt?.id ?? "",
  );
  const [topK, setTopK] = useState(5);
  const [vectorWeight, setVectorWeight] = useState(0.7);
  const [useQueryRewrite, setUseQueryRewrite] = useState(true);
  const [maxRewrittenQueries, setMaxRewrittenQueries] =
    useState(4);

  const [result, setResult] = useState<RagAskResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keywordWeight = Number((1 - vectorWeight).toFixed(1));

  async function runPipeline() {
    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length < 3) {
      setError("Enter a question with at least three characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload: RagAskRequest = {
      question: trimmedQuestion,
      top_k: topK,
      vector_weight: vectorWeight,
      keyword_weight: keywordWeight,
      use_query_rewrite: useQueryRewrite,
      max_rewritten_queries: maxRewrittenQueries,
      prompt_version_id: promptVersionId || null,
    };

    try {
      const response = await apiPost<RagAskRequest, RagAskResponse>(
        "/rag/ask",
        payload,
      );

      setResult(response);
    } catch (requestError) {
      setResult(null);

      setError(
        requestError instanceof Error
          ? requestError.message
          : "The RAG request failed unexpectedly.",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setQuestion(DEFAULT_QUESTION);
    setPromptVersionId(defaultPrompt?.id ?? "");
    setTopK(5);
    setVectorWeight(0.7);
    setUseQueryRewrite(true);
    setMaxRewrittenQueries(4);
    setResult(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-[1700px]">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Interactive Agentic RAG Execution
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Advanced RAG playground
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Execute the complete retrieval, reranking, citation-first
            generation, claim verification, and quality-scoring
            pipeline from one workspace.
          </p>
        </div>

        <StatusBadge variant="success">
          Agent trace enabled
        </StatusBadge>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <BrainCircuit className="h-5 w-5" />
            </div>

            <div>
              <h3 className="font-semibold text-slate-950">
                Pipeline configuration
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Tune retrieval and prompt settings.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Question
              </span>

              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={5}
                placeholder="Ask a question about your indexed documents..."
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Prompt version
              </span>

              <div className="relative mt-2">
                <select
                  value={promptVersionId}
                  onChange={(event) =>
                    setPromptVersionId(event.target.value)
                  }
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-3 pr-10 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="">
                    Built-in citation-first prompt
                  </option>

                  {prompts.map((prompt) => (
                    <option
                      key={prompt.id}
                      value={prompt.id}
                    >
                      {prompt.name}
                      {prompt.is_default ? " — Default" : ""}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
              </div>
            </label>

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">
                  Top-k chunks
                </span>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {topK}
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={topK}
                onChange={(event) =>
                  setTopK(Number(event.target.value))
                }
                className="mt-3 w-full accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">
                  Retrieval weighting
                </span>

                <span className="text-xs font-semibold text-slate-500">
                  Vector {vectorWeight.toFixed(1)} · Keyword{" "}
                  {keywordWeight.toFixed(1)}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={vectorWeight}
                onChange={(event) =>
                  setVectorWeight(Number(event.target.value))
                }
                className="mt-3 w-full accent-indigo-600"
              />

              <div className="mt-2 flex justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <span>Keyword-heavy</span>
                <span>Vector-heavy</span>
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Query rewriting
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Generate diverse retrieval-focused queries.
                </p>
              </div>

              <input
                type="checkbox"
                checked={useQueryRewrite}
                onChange={(event) =>
                  setUseQueryRewrite(event.target.checked)
                }
                className="h-4 w-4 accent-indigo-600"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Maximum rewritten queries
              </span>

              <select
                value={maxRewrittenQueries}
                onChange={(event) =>
                  setMaxRewrittenQueries(
                    Number(event.target.value),
                  )
                }
                disabled={!useQueryRewrite}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                {[1, 2, 3, 4, 5, 6].map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
                ))}
              </select>
            </label>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <button
                type="button"
                onClick={runPipeline}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Running pipeline...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run pipeline
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetForm}
                aria-label="Reset playground"
                className="rounded-xl border border-slate-200 bg-white px-4 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          {!result && !loading && (
            <section className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <div className="max-w-md">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Sparkles className="h-7 w-7" />
                </div>

                <h3 className="mt-5 text-xl font-semibold text-slate-950">
                  Ready to run the agentic pipeline
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Submit a question to view rewritten queries,
                  retrieved evidence, inline citations, claim-level
                  grounding verification, and execution traces.
                </p>
              </div>
            </section>
          )}

          {loading && (
            <section className="flex min-h-[520px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div>
                <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-indigo-600" />

                <h3 className="mt-5 text-lg font-semibold text-slate-950">
                  Running the advanced RAG pipeline
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Query rewriting, hybrid retrieval, answer
                  generation, and claim verification may take several
                  seconds.
                </p>
              </div>
            </section>
          )}

          {result && !loading && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                      Generated answer
                    </p>

                    <h3 className="mt-2 text-lg font-semibold text-slate-950">
                      Citation-first response
                    </h3>
                  </div>

                  <StatusBadge
                    variant={
                      result.answer_generation_strategy ===
                      "llm_citation_first"
                        ? "success"
                        : "warning"
                    }
                  >
                    {formatLabel(
                      result.answer_generation_strategy,
                    )}
                  </StatusBadge>
                </div>

                <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {result.answer}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {result.citations.map((citation, index) => (
                    <span
                      key={`${citation.chunk_id}-${index}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                    >
                      <BookOpenText className="h-3.5 w-3.5" />
                      S{index + 1} · {citation.file_name}
                      {citation.page_number !== null
                        ? ` · Page ${citation.page_number}`
                        : ""}
                    </span>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricPanel
                  label="Retrieval score"
                  value={formatPercentage(
                    result.metrics.retrieval_score,
                  )}
                  icon={Search}
                />

                <MetricPanel
                  label="Grounding score"
                  value={formatPercentage(
                    result.metrics.grounding_score,
                  )}
                  icon={ShieldCheck}
                />

                <MetricPanel
                  label="Citation coverage"
                  value={formatPercentage(
                    result.metrics.citation_coverage,
                  )}
                  icon={FileText}
                />

                <MetricPanel
                  label="Pipeline latency"
                  value={formatLatency(result.metrics.latency_ms)}
                  icon={Clock3}
                />
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-50 p-3 text-cyan-600">
                    <Network className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-950">
                      Rewritten queries
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Multi-query retrieval inputs generated for the
                      search stage.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {result.rewritten_queries.map((query, index) => (
                    <span
                      key={`${query}-${index}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium leading-5 text-slate-700"
                    >
                      {index + 1}. {query}
                    </span>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-950">
                      Claim-level grounding verification
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Strategy:{" "}
                      {formatLabel(
                        result.verification_report.strategy,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {result.verification_report.claims.map(
                    (claim, index) => (
                      <article
                        key={`${claim.claim}-${index}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <p className="max-w-4xl text-sm font-medium leading-6 text-slate-800">
                            {claim.claim}
                          </p>

                          <StatusBadge
                            variant={verificationVariant(
                              claim.status,
                            )}
                          >
                            {formatLabel(claim.status)}
                          </StatusBadge>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-slate-500">
                          {claim.explanation}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {claim.source_labels.map((label) => (
                            <span
                              key={label}
                              className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </article>
                    ),
                  )}
                </div>

                {result.verification_report.fallback_reason && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-700">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {result.verification_report.fallback_reason}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-violet-50 p-3 text-violet-600">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-950">
                      Retrieved evidence chunks
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Hybrid-ranked document context supplied to the
                      answer agent.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  {result.retrieved_chunks.map((chunk, index) => (
                    <article
                      key={chunk.chunk_id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            S{index + 1} · {chunk.file_name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Chunk {chunk.chunk_index}
                            {chunk.page_number !== null
                              ? ` · Page ${chunk.page_number}`
                              : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <ScoreChip
                            label="Vector"
                            value={chunk.vector_score}
                          />

                          <ScoreChip
                            label="Keyword"
                            value={chunk.keyword_score}
                          />

                          <ScoreChip
                            label="Hybrid"
                            value={chunk.hybrid_score}
                          />
                        </div>
                      </div>

                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {chunk.content}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-sky-50 p-3 text-sky-600">
                    <Activity className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-950">
                      Agent execution trace
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Observable pipeline steps recorded during this
                      RAG run.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {result.agent_trace.map((step, index) => (
                    <div
                      key={`${step.step_name}-${index}`}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-indigo-600 ring-1 ring-inset ring-slate-200">
                          {index + 1}
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {formatLabel(step.step_name)}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Status: {formatLabel(step.status)}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatLatency(step.latency_ms)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Selected prompt
                    </p>

                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {result.selected_prompt_version_name}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      RAG run ID
                    </p>

                    <p className="mt-2 break-all font-mono text-xs text-slate-600">
                      {result.rag_run_id}
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </section>
    </div>
  );
}

interface MetricPanelProps {
  label: string;
  value: string;
  icon: typeof Gauge;
}

function MetricPanel({
  label,
  value,
  icon: Icon,
}: MetricPanelProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

interface ScoreChipProps {
  label: string;
  value: number;
}

function ScoreChip({
  label,
  value,
}: ScoreChipProps) {
  return (
    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      {label}: {(value * 100).toFixed(1)}%
    </span>
  );
}
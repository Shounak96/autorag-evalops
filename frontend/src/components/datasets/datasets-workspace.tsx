"use client";

import {
  AlertCircle,
  CheckCircle2,
  Database,
  FilePlus2,
  LoaderCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createDataset,
  createTestCase,
  deleteTestCase,
  getDataset,
  listDatasets,
  runDataset,
} from "@/lib/datasets-api";
import { listPrompts } from "@/lib/prompts-api";
import type {
  EvalDataset,
  EvalDatasetDetailResponse,
  EvalDatasetRunSummary,
  EvalTestCase,
  PromptVersion,
} from "@/lib/types";

const DEFAULT_THRESHOLDS = {
  min_pass_rate: 0.8,
  min_retrieval_score: 0.2,
  min_grounding_score: 0.75,
  min_citation_coverage: 1.0,
  min_answer_score: 0.6,
  max_unsupported_claims: 0,
  max_avg_latency_ms: 15000,
  baseline_run_id: null,
  max_pass_rate_drop: 0.1,
  max_answer_score_drop: 0.15,
  max_retrieval_score_drop: 0.15,
  max_grounding_score_drop: 0.1,
  max_citation_coverage_drop: 0.1,
};

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export function DatasetsWorkspace() {
  const [datasets, setDatasets] = useState<EvalDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] =
    useState<string>("");
  const [selectedDataset, setSelectedDataset] =
    useState<EvalDatasetDetailResponse | null>(null);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);

  const [loading, setLoading] = useState(true);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [runningDataset, setRunningDataset] = useState(false);
  const [creatingDataset, setCreatingDataset] = useState(false);
  const [creatingTestCase, setCreatingTestCase] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const [newDatasetName, setNewDatasetName] = useState("");
  const [newDatasetDescription, setNewDatasetDescription] =
    useState("");

  const [question, setQuestion] = useState("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [requiredDocumentName, setRequiredDocumentName] =
    useState("");
  const [tags, setTags] = useState("");

  const [selectedPromptId, setSelectedPromptId] =
    useState<string>("");
  const [topK, setTopK] = useState(5);
  const [vectorWeight, setVectorWeight] = useState(0.7);
  const [keywordWeight, setKeywordWeight] = useState(0.3);
  const [useQueryRewrite, setUseQueryRewrite] = useState(true);
  const [maxRewrittenQueries, setMaxRewrittenQueries] =
    useState(4);

  const [latestRun, setLatestRun] =
    useState<EvalDatasetRunSummary | null>(null);

  const selectedPromptName = useMemo(() => {
    if (!selectedPromptId) {
      return "Default prompt";
    }

    return (
      prompts.find((prompt) => prompt.id === selectedPromptId)
        ?.name ?? "Selected prompt"
    );
  }, [prompts, selectedPromptId]);

  async function refreshDatasets() {
    setError(null);
    setSuccessMessage(null);

    try {
      const [datasetsResponse, promptsResponse] =
        await Promise.all([listDatasets(), listPrompts()]);

      setDatasets(datasetsResponse.datasets);
      setPrompts(promptsResponse.prompts);

      const nextSelectedId =
        selectedDatasetId || datasetsResponse.datasets[0]?.id || "";

      setSelectedDatasetId(nextSelectedId);

      if (nextSelectedId) {
        await loadDataset(nextSelectedId);
      } else {
        setSelectedDataset(null);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function loadDataset(
  datasetId: string,
  options?: { clearLatestRun?: boolean },
) {
  setDatasetLoading(true);
  setError(null);
  setSuccessMessage(null);

  try {
    const detail = await getDataset(datasetId);

    setSelectedDataset(detail);
    setSelectedDatasetId(datasetId);

    if (options?.clearLatestRun ?? true) {
      setLatestRun(null);
    }
  } catch (requestError) {
    setError(getErrorMessage(requestError));
  } finally {
    setDatasetLoading(false);
  }
}

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);

      try {
        const [datasetsResponse, promptsResponse] =
          await Promise.all([listDatasets(), listPrompts()]);

        if (cancelled) {
          return;
        }

        setDatasets(datasetsResponse.datasets);
        setPrompts(promptsResponse.prompts);

        const firstDatasetId =
          datasetsResponse.datasets[0]?.id ?? "";

        setSelectedDatasetId(firstDatasetId);

        if (firstDatasetId) {
          const detail = await getDataset(firstDatasetId);

          if (!cancelled) {
            setSelectedDataset(detail);
          }
        }
      } catch (requestError) {
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

  async function handleCreateDataset(event: FormEvent) {
    event.preventDefault();

    if (newDatasetName.trim().length < 3) {
      setError("Dataset name must be at least 3 characters.");
      return;
    }

    setCreatingDataset(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const createdDataset = await createDataset({
        name: newDatasetName.trim(),
        description:
          newDatasetDescription.trim().length > 0
            ? newDatasetDescription.trim()
            : null,
      });

      setNewDatasetName("");
      setNewDatasetDescription("");
      setSuccessMessage("Dataset created successfully.");

      const datasetsResponse = await listDatasets();

      setDatasets(datasetsResponse.datasets);
      setSelectedDatasetId(createdDataset.id);
      await loadDataset(createdDataset.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setCreatingDataset(false);
    }
  }

  async function handleCreateTestCase(event: FormEvent) {
    event.preventDefault();

    if (!selectedDatasetId) {
      setError("Select a dataset first.");
      return;
    }

    if (question.trim().length < 3) {
      setError("Question must be at least 3 characters.");
      return;
    }

    setCreatingTestCase(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await createTestCase(selectedDatasetId, {
        question: question.trim(),
        expected_answer:
          expectedAnswer.trim().length > 0
            ? expectedAnswer.trim()
            : null,
        required_document_name:
          requiredDocumentName.trim().length > 0
            ? requiredDocumentName.trim()
            : null,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      setQuestion("");
      setExpectedAnswer("");
      setRequiredDocumentName("");
      setTags("");

      setSuccessMessage("Test case added successfully.");
      await loadDataset(selectedDatasetId, { clearLatestRun: false });
      await refreshDatasetListOnly();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setCreatingTestCase(false);
    }
  }

  async function refreshDatasetListOnly() {
    const datasetsResponse = await listDatasets();

    setDatasets(datasetsResponse.datasets);
  }

  async function handleDeleteTestCase(testCaseId: string) {
    if (!selectedDatasetId) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await deleteTestCase(testCaseId);
      setSuccessMessage("Test case deleted.");
      await loadDataset(selectedDatasetId, { clearLatestRun: false });
      await refreshDatasetListOnly();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function handleRunDataset() {
    if (!selectedDatasetId) {
      setError("Select a dataset first.");
      return;
    }

    if (!selectedDataset || selectedDataset.test_cases.length === 0) {
      setError("Add at least one test case before running the dataset.");
      return;
    }

    setRunningDataset(true);
    setError(null);
    setSuccessMessage(null);
    setLatestRun(null);

    try {
      const summary = await runDataset(selectedDatasetId, {
        top_k: topK,
        vector_weight: vectorWeight,
        keyword_weight: keywordWeight,
        use_query_rewrite: useQueryRewrite,
        max_rewritten_queries: maxRewrittenQueries,
        prompt_version_id: selectedPromptId || null,
        thresholds: DEFAULT_THRESHOLDS,
      });

      setLatestRun(summary);
      setSuccessMessage("Dataset run completed.");
      await loadDataset(selectedDatasetId, { clearLatestRun: false });
      await refreshDatasetListOnly();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setRunningDataset(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1700px]">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Evaluation Management
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Evaluation datasets
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Create reusable regression datasets, add test cases,
            and run RAG evaluations directly from the UI without
            using Swagger.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshDatasets}
          disabled={loading || datasetLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading || datasetLoading ? "animate-spin" : ""
            }`}
          />
          Refresh datasets
        </button>
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

      {loading ? (
        <div className="mt-8 flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div>
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
            <p className="mt-4 text-sm font-semibold text-slate-700">
              Loading datasets...
            </p>
          </div>
        </div>
      ) : (
        <section className="mt-8 grid gap-6 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <form
              onSubmit={handleCreateDataset}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
                  <Database className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-semibold text-slate-950">
                    Create dataset
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Group related RAG test cases.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <InputField
                  label="Dataset name"
                  value={newDatasetName}
                  onChange={setNewDatasetName}
                  placeholder="Customer Policy Regression Tests"
                />

                <TextAreaField
                  label="Description"
                  value={newDatasetDescription}
                  onChange={setNewDatasetDescription}
                  placeholder="Questions used to validate customer-facing policy answers."
                  rows={4}
                />

                <button
                  type="submit"
                  disabled={creatingDataset}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {creatingDataset ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create dataset
                </button>
              </div>
            </form>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-950">
                Select dataset
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Choose a dataset to manage test cases and run
                evaluations.
              </p>

              <div className="mt-5 space-y-3">
                {datasets.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No datasets yet. Create one above.
                  </p>
                ) : (
                  datasets.map((dataset) => (
                    <button
                      key={dataset.id}
                      type="button"
                      onClick={() => loadDataset(dataset.id)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        selectedDatasetId === dataset.id
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-slate-200 bg-slate-50 hover:bg-white"
                      }`}
                    >
                      <p className="font-semibold text-slate-950">
                        {dataset.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {dataset.test_case_count} test case
                        {dataset.test_case_count === 1 ? "" : "s"}
                      </p>

                      <p className="mt-2 text-[11px] text-slate-400">
                        Created {formatDate(dataset.created_at)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>

          <main className="space-y-6">
            {!selectedDataset ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="max-w-sm">
                  <Database className="mx-auto h-10 w-10 text-slate-300" />

                  <h3 className="mt-4 font-semibold text-slate-800">
                    No dataset selected
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Create or select a dataset to begin adding test
                    cases.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div>
                      <p className="text-sm font-semibold text-indigo-600">
                        Selected dataset
                      </p>

                      <h3 className="mt-2 text-2xl font-bold text-slate-950">
                        {selectedDataset.name}
                      </h3>

                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                        {selectedDataset.description ??
                          "No description provided."}
                      </p>

                      <p className="mt-3 font-mono text-[11px] text-slate-400">
                        Dataset ID: {selectedDataset.id}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Test cases
                      </p>

                      <p className="mt-2 text-3xl font-bold text-slate-950">
                        {selectedDataset.test_cases.length}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
                  <form
                    onSubmit={handleCreateTestCase}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
                        <FilePlus2 className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-slate-950">
                          Add test case
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Define a question and expected behavior.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      <TextAreaField
                        label="Question"
                        value={question}
                        onChange={setQuestion}
                        placeholder="What quality metrics does AutoRAG EvalOps evaluate before deployment?"
                        rows={3}
                      />

                      <TextAreaField
                        label="Expected answer"
                        value={expectedAnswer}
                        onChange={setExpectedAnswer}
                        placeholder="AutoRAG EvalOps evaluates retrieval accuracy, citation coverage, grounding quality, unsupported claims, and latency."
                        rows={4}
                      />

                      <InputField
                        label="Required document name"
                        value={requiredDocumentName}
                        onChange={setRequiredDocumentName}
                        placeholder="rag_test.txt"
                      />

                      <InputField
                        label="Tags"
                        value={tags}
                        onChange={setTags}
                        placeholder="quality-gate, regression, grounding"
                      />

                      <button
                        type="submit"
                        disabled={creatingTestCase}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                      >
                        {creatingTestCase ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Add test case
                      </button>
                    </div>
                  </form>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-950">
                      Run settings
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Configure how this dataset should evaluate the
                      RAG pipeline.
                    </p>

                    <div className="mt-5 space-y-4">
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Prompt version
                        </span>

                        <select
                          value={selectedPromptId}
                          onChange={(event) =>
                            setSelectedPromptId(event.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                        >
                          <option value="">Default prompt</option>

                          {prompts.map((prompt) => (
                            <option
                              key={prompt.id}
                              value={prompt.id}
                            >
                              {prompt.name}
                              {prompt.is_default
                                ? " — default"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>

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
                        label="Max rewritten queries"
                        value={maxRewrittenQueries}
                        min={1}
                        max={6}
                        step={1}
                        onChange={setMaxRewrittenQueries}
                      />

                      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <span className="text-sm font-semibold text-slate-700">
                          Use query rewrite
                        </span>

                        <input
                          type="checkbox"
                          checked={useQueryRewrite}
                          onChange={(event) =>
                            setUseQueryRewrite(
                              event.target.checked,
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleRunDataset}
                        disabled={runningDataset}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                      >
                        {runningDataset ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlayCircle className="h-4 w-4" />
                        )}
                        Run dataset
                      </button>

                      <p className="text-xs leading-5 text-slate-500">
                        Selected prompt: {selectedPromptName}
                      </p>
                    </div>
                  </section>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        Test cases
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        These questions will be executed during a
                        dataset run.
                      </p>
                    </div>

                    <span className="text-xs font-semibold text-slate-500">
                      {selectedDataset.test_cases.length} case
                      {selectedDataset.test_cases.length === 1
                        ? ""
                        : "s"}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {selectedDataset.test_cases.length === 0 ? (
                      <div className="p-8 text-center">
                        <FilePlus2 className="mx-auto h-10 w-10 text-slate-300" />

                        <h4 className="mt-4 font-semibold text-slate-800">
                          No test cases yet
                        </h4>

                        <p className="mt-2 text-sm text-slate-500">
                          Add your first test case using the form
                          above.
                        </p>
                      </div>
                    ) : (
                      selectedDataset.test_cases.map(
                        (testCase, index) => (
                          <TestCaseRow
                            key={testCase.id}
                            testCase={testCase}
                            index={index}
                            onDelete={() =>
                              handleDeleteTestCase(testCase.id)
                            }
                          />
                        ),
                      )
                    )}
                  </div>
                </section>

                {latestRun && (
                  <RunSummaryCard summary={latestRun} />
                )}
              </>
            )}
          </main>
        </section>
      )}
    </div>
  );
}

interface TestCaseRowProps {
  testCase: EvalTestCase;
  index: number;
  onDelete: () => void;
}

function TestCaseRow({
  testCase,
  index,
  onDelete,
}: TestCaseRowProps) {
  return (
    <article className="p-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              Case {index + 1}
            </span>

            {testCase.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
              >
                {tag}
              </span>
            ))}
          </div>

          <h4 className="mt-3 text-sm font-semibold text-slate-950">
            {testCase.question}
          </h4>

          {testCase.expected_answer && (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Expected: {testCase.expected_answer}
            </p>
          )}

          {testCase.required_document_name && (
            <p className="mt-2 font-mono text-[11px] text-slate-400">
              Required document: {testCase.required_document_name}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </article>
  );
}

interface RunSummaryCardProps {
  summary: EvalDatasetRunSummary;
}

function RunSummaryCard({
  summary,
}: RunSummaryCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {summary.quality_gate_passed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Quality gate passed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                <XCircle className="h-3.5 w-3.5" />
                Quality gate failed
              </span>
            )}

            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {summary.status}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-bold text-slate-950">
            Latest dataset run
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Prompt: {summary.prompt_version_name}
          </p>

          <p className="mt-2 font-mono text-[11px] text-slate-400">
            Run ID: {summary.rag_run_id}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MiniRunMetric
          label="Pass rate"
          value={formatPercentage(summary.pass_rate)}
        />

        <MiniRunMetric
          label="Cases"
          value={`${summary.passed_cases}/${summary.total_cases}`}
        />

        <MiniRunMetric
          label="Retrieval"
          value={formatPercentage(summary.avg_retrieval_score)}
        />

        <MiniRunMetric
          label="Grounding"
          value={formatPercentage(summary.avg_grounding_score)}
        />

        <MiniRunMetric
          label="Citations"
          value={formatPercentage(summary.avg_citation_coverage)}
        />

        <MiniRunMetric
          label="Latency"
          value={formatLatency(summary.avg_latency_ms)}
        />
      </div>
    </section>
  );
}

interface MiniRunMetricProps {
  label: string;
  value: string;
}

function MiniRunMetric({
  label,
  value,
}: MiniRunMetricProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: InputFieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      />
    </label>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: TextAreaFieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      />
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
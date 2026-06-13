"use client";

import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileText,
  LoaderCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  deleteDocument,
  listDocuments,
  processDocument,
  uploadDocument,
} from "@/lib/documents-api";
import type { DocumentRecord } from "@/lib/types";

const ACCEPTED_FILE_TYPES = ".pdf,.txt,.md,.csv";

type Notice =
  | {
      variant: "success" | "error";
      message: string;
    }
  | null;

function formatFileSize(bytes: number | null): string {
  if (bytes === null) {
    return "Unknown size";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function statusMetadata(status: string): {
  label: string;
  className: string;
} {
  if (status === "processed") {
    return {
      label: "Indexed",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (status === "processed_empty") {
    return {
      label: "No content",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Pending processing",
    className:
      "border-sky-200 bg-sky-50 text-sky-700",
  };
}

export function DocumentsWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentRecord[]>(
    [],
  );
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const [loadingDocuments, setLoadingDocuments] =
    useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [processingDocumentId, setProcessingDocumentId] =
    useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] =
    useState<string | null>(null);

  const refreshDocuments = useCallback(async () => {
    setLoadingDocuments(true);

    try {
      const response = await listDocuments();

      setDocuments(response.documents);
    } catch (error) {
      setNotice({
        variant: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

    useEffect(() => {
    let cancelled = false;

    listDocuments()
      .then((response) => {
        if (!cancelled) {
          setDocuments(response.documents);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setNotice({
            variant: "error",
            message: getErrorMessage(error),
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDocuments(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function chooseFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setNotice(null);
  }

  function handleFileInput(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    chooseFile(event.target.files?.[0]);
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    setDragActive(false);

    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function handleUpload() {
    if (!selectedFile) {
      setNotice({
        variant: "error",
        message: "Select a document before uploading.",
      });

      return;
    }

    setUploading(true);
    setNotice(null);

    try {
      const uploadedDocument = await uploadDocument(
        selectedFile,
      );

      setNotice({
        variant: "success",
        message:
          `${uploadedDocument.file_name} uploaded successfully. ` +
          "Process the document to generate chunks and embeddings.",
      });

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await refreshDocuments();
    } catch (error) {
      setNotice({
        variant: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleProcess(document: DocumentRecord) {
    setProcessingDocumentId(document.id);
    setNotice(null);

    try {
      const response = await processDocument(document.id);

      setNotice({
        variant: "success",
        message:
          `${document.file_name} processed successfully with ` +
          `${response.total_chunks} chunk${
            response.total_chunks === 1 ? "" : "s"
          }.`,
      });

      await refreshDocuments();
    } catch (error) {
      setNotice({
        variant: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setProcessingDocumentId(null);
    }
  }

  async function handleDelete(document: DocumentRecord) {
    const confirmed = window.confirm(
      `Delete "${document.file_name}" and its related chunks?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingDocumentId(document.id);
    setNotice(null);

    try {
      await deleteDocument(document.id);

      setNotice({
        variant: "success",
        message:
          `${document.file_name} and its related chunks were deleted.`,
      });

      await refreshDocuments();
    } catch (error) {
      setNotice({
        variant: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setDeletingDocumentId(null);
    }
  }

  const indexedDocuments = documents.filter(
    (document) => document.status === "processed",
  ).length;

  const totalChunks = documents.reduce(
    (sum, document) => sum + document.total_chunks,
    0,
  );

  return (
    <div className="mx-auto max-w-[1700px]">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Knowledge Base Management
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Documents
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Upload knowledge sources, generate embeddings, monitor
            indexing status, and manage evidence used by the agentic
            RAG pipeline.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshDocuments}
          disabled={loadingDocuments}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loadingDocuments ? "animate-spin" : ""
            }`}
          />
          Refresh documents
        </button>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Documents"
          value={documents.length.toString()}
          helper="Knowledge sources available"
          icon={Database}
        />

        <MetricCard
          label="Indexed documents"
          value={indexedDocuments.toString()}
          helper="Ready for retrieval"
          icon={ShieldCheck}
        />

        <MetricCard
          label="Total chunks"
          value={totalChunks.toString()}
          helper="Evidence units with embeddings"
          icon={FileText}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <UploadCloud className="h-5 w-5" />
            </div>

            <div>
              <h3 className="font-semibold text-slate-950">
                Upload knowledge source
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                SHA-256 duplicate protection is enabled.
              </p>
            </div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-5 rounded-xl border-2 border-dashed p-6 text-center transition ${
              dragActive
                ? "border-indigo-400 bg-indigo-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <UploadCloud className="mx-auto h-8 w-8 text-indigo-500" />

            <p className="mt-4 text-sm font-semibold text-slate-800">
              Drop a document here
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Supported formats: PDF, TXT, MD, and CSV
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Choose file
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {selectedFile && (
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Selected file
              </p>

              <p className="mt-2 break-all text-sm font-semibold text-slate-800">
                {selectedFile.name}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {uploading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Upload document
              </>
            )}
          </button>
        </aside>

        <main className="min-w-0">
          {notice && (
            <div
              className={`mb-4 flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${
                notice.variant === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {notice.variant === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}

              {notice.message}
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Knowledge sources
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Processed documents become available to hybrid
                  retrieval.
                </p>
              </div>

              <span className="text-xs font-semibold text-slate-500">
                {documents.length} document
                {documents.length === 1 ? "" : "s"}
              </span>
            </div>

            {loadingDocuments ? (
              <div className="flex min-h-[320px] items-center justify-center p-8 text-center">
                <div>
                  <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-indigo-600" />

                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    Loading documents...
                  </p>
                </div>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex min-h-[320px] items-center justify-center p-8 text-center">
                <div className="max-w-sm">
                  <FileText className="mx-auto h-10 w-10 text-slate-300" />

                  <h4 className="mt-4 font-semibold text-slate-800">
                    No documents uploaded
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Upload a document to begin generating chunks and
                    embeddings for retrieval.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((document) => {
                  const metadata = statusMetadata(
                    document.status,
                  );

                  const processing =
                    processingDocumentId === document.id;

                  const deleting =
                    deletingDocumentId === document.id;

                  return (
                    <article
                      key={document.id}
                      className="p-5 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-500" />

                            <p className="break-all text-sm font-semibold text-slate-900">
                              {document.file_name}
                            </p>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${metadata.className}`}
                            >
                              {metadata.label}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                            <span>
                              Type: {document.file_type.toUpperCase()}
                            </span>

                            <span>
                              Size: {formatFileSize(document.file_size)}
                            </span>

                            <span>
                              Chunks: {document.total_chunks}
                            </span>

                            <span>
                              Uploaded: {formatDate(document.created_at)}
                            </span>
                          </div>

                          {document.content_hash && (
                            <p className="mt-3 truncate font-mono text-[11px] text-slate-400">
                              SHA-256: {document.content_hash}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          {document.status !== "processed" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleProcess(document)
                              }
                              disabled={processing || deleting}
                              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {processing ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PlayCircle className="h-3.5 w-3.5" />
                              )}

                              {processing
                                ? "Processing..."
                                : "Process"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(document)
                            }
                            disabled={processing || deleting}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deleting ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}

                            {deleting ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </section>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  icon: typeof Database;
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
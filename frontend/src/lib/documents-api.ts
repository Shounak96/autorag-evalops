import type {
  DeleteDocumentResponse,
  DocumentListResponse,
  DocumentRecord,
  ProcessDocumentResponse,
} from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

interface ApiErrorBody {
  detail?: string;
}

async function parseError(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const errorBody = (await response.json()) as ApiErrorBody;

    return errorBody.detail ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function listDocuments(): Promise<DocumentListResponse> {
  const response = await fetch(`${API_BASE_URL}/documents`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      await parseError(
        response,
        "Unable to load documents.",
      ),
    );
  }

  return (await response.json()) as DocumentListResponse;
}

export async function uploadDocument(
  file: File,
): Promise<DocumentRecord> {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/documents/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(
        response,
        "Document upload failed.",
      ),
    );
  }

  return (await response.json()) as DocumentRecord;
}

export async function processDocument(
  documentId: string,
): Promise<ProcessDocumentResponse> {
  const response = await fetch(
    `${API_BASE_URL}/documents/${documentId}/process`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(
        response,
        "Document processing failed.",
      ),
    );
  }

  return (await response.json()) as ProcessDocumentResponse;
}

export async function deleteDocument(
  documentId: string,
): Promise<DeleteDocumentResponse> {
  const response = await fetch(
    `${API_BASE_URL}/documents/${documentId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(
        response,
        "Document deletion failed.",
      ),
    );
  }

  return (await response.json()) as DeleteDocumentResponse;
}
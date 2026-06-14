import type {
  DeleteEvalTestCaseResponse,
  EvalDatasetCreateRequest,
  EvalDatasetDetailResponse,
  EvalDatasetListResponse,
  EvalDatasetRunRequest,
  EvalDatasetRunSummary,
  EvalTestCaseCreateRequest,
  EvalTestCase,
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

export async function listDatasets(): Promise<EvalDatasetListResponse> {
  const response = await fetch(`${API_BASE_URL}/eval/datasets`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to load datasets."),
    );
  }

  return (await response.json()) as EvalDatasetListResponse;
}

export async function createDataset(
  payload: EvalDatasetCreateRequest,
): Promise<EvalDatasetDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/eval/datasets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to create dataset."),
    );
  }

  return (await response.json()) as EvalDatasetDetailResponse;
}

export async function getDataset(
  datasetId: string,
): Promise<EvalDatasetDetailResponse> {
  const response = await fetch(
    `${API_BASE_URL}/eval/datasets/${datasetId}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to load dataset."),
    );
  }

  return (await response.json()) as EvalDatasetDetailResponse;
}

export async function createTestCase(
  datasetId: string,
  payload: EvalTestCaseCreateRequest,
): Promise<EvalTestCase> {
  const response = await fetch(
    `${API_BASE_URL}/eval/datasets/${datasetId}/test-cases`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to create test case."),
    );
  }

  return (await response.json()) as EvalTestCase;
}

export async function deleteTestCase(
  testCaseId: string,
): Promise<DeleteEvalTestCaseResponse> {
  const response = await fetch(
    `${API_BASE_URL}/eval/test-cases/${testCaseId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to delete test case."),
    );
  }

  return (await response.json()) as DeleteEvalTestCaseResponse;
}

export async function runDataset(
  datasetId: string,
  payload: EvalDatasetRunRequest,
): Promise<EvalDatasetRunSummary> {
  const response = await fetch(
    `${API_BASE_URL}/eval/datasets/${datasetId}/run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to run dataset."),
    );
  }

  return (await response.json()) as EvalDatasetRunSummary;
}
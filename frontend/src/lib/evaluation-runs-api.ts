import type {
  EvalRunListResponse,
  EvalRunResultsResponse,
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

export async function listEvaluationRuns(
  limit = 30,
): Promise<EvalRunListResponse> {
  const response = await fetch(
    `${API_BASE_URL}/eval/runs?limit=${limit}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(
        response,
        "Unable to load evaluation runs.",
      ),
    );
  }

  return (await response.json()) as EvalRunListResponse;
}

export async function getEvaluationRunResults(
  ragRunId: string,
): Promise<EvalRunResultsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/eval/runs/${ragRunId}/results`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(
        response,
        "Unable to load evaluation-run results.",
      ),
    );
  }

  return (await response.json()) as EvalRunResultsResponse;
}
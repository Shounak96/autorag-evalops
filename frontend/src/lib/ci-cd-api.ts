import type {
  EvalRun,
  EvalRunListResponse,
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

export async function listCiCdRuns(
  limit = 50,
): Promise<EvalRun[]> {
  const response = await fetch(
    `${API_BASE_URL}/eval/runs?limit=${limit}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to load CI/CD runs."),
    );
  }

  const payload =
    (await response.json()) as EvalRunListResponse;

  return payload.runs;
}

export function splitRunsBySource(runs: EvalRun[]) {
  const ciRuns = runs.filter((run) => run.source === "ci");
  const manualRuns = runs.filter(
    (run) => run.source !== "ci",
  );

  return {
    ciRuns,
    manualRuns,
  };
}
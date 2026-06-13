import type {
  EvalRun,
  EvalRunResult,
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

export interface QualityGateRunDetail extends EvalRun {
  results: EvalRunResult[];
}

export async function getLatestQualityGateRun(): Promise<QualityGateRunDetail | null> {
  const runsResponse = await fetch(
    `${API_BASE_URL}/eval/runs?limit=1`,
    {
      cache: "no-store",
    },
  );

  if (!runsResponse.ok) {
    throw new Error(
      await parseError(
        runsResponse,
        "Unable to load latest quality-gate run.",
      ),
    );
  }

  const runsPayload =
    (await runsResponse.json()) as { runs: EvalRun[]; count: number };

  const latestRun = runsPayload.runs[0];

  if (!latestRun) {
    return null;
  }

  const resultsResponse = await fetch(
    `${API_BASE_URL}/eval/runs/${latestRun.rag_run_id}/results`,
    {
      cache: "no-store",
    },
  );

  if (!resultsResponse.ok) {
    throw new Error(
      await parseError(
        resultsResponse,
        "Unable to load quality-gate case results.",
      ),
    );
  }

  const resultsPayload =
    (await resultsResponse.json()) as EvalRunResultsResponse;

  return {
    ...latestRun,
    results: resultsPayload.results,
  };
}
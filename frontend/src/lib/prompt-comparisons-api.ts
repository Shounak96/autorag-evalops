import type {
  PromptComparisonListResponse,
  PromptComparisonResponse,
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

export async function listPromptComparisons(
  limit = 10,
): Promise<PromptComparisonListResponse> {
  const response = await fetch(
    `${API_BASE_URL}/eval/prompt-comparisons?limit=${limit}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(
        response,
        "Unable to load prompt comparisons.",
      ),
    );
  }

  return (await response.json()) as PromptComparisonListResponse;
}

export interface RunPromptComparisonPayload {
  prompt_version_a_id: string;
  prompt_version_b_id: string;
  top_k: number;
  vector_weight: number;
  keyword_weight: number;
  use_query_rewrite: boolean;
  max_rewritten_queries: number;
  thresholds: {
    min_pass_rate: number;
    min_retrieval_score: number;
    min_grounding_score: number;
    min_citation_coverage: number;
    min_answer_score: number;
    max_unsupported_claims: number;
  };
}

export async function runPromptComparison(
  datasetId: string,
  payload: RunPromptComparisonPayload,
): Promise<PromptComparisonResponse> {
  const response = await fetch(
    `${API_BASE_URL}/eval/datasets/${datasetId}/compare-prompts`,
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
      await parseError(
        response,
        "Unable to run prompt comparison.",
      ),
    );
  }

  return (await response.json()) as PromptComparisonResponse;
}
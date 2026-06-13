import type { PromptComparisonListResponse } from "@/lib/types";

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
import type {
  PromptListResponse,
  PromptVersion,
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

export async function listPrompts(): Promise<PromptListResponse> {
  const response = await fetch(`${API_BASE_URL}/prompts`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      await parseError(
        response,
        "Unable to load prompt versions.",
      ),
    );
  }

  return (await response.json()) as PromptListResponse;
}

export async function setDefaultPrompt(
  promptVersionId: string,
): Promise<PromptVersion> {
  const response = await fetch(
    `${API_BASE_URL}/prompts/${promptVersionId}/default`,
    {
      method: "PATCH",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(
        response,
        "Unable to set default prompt.",
      ),
    );
  }

  return (await response.json()) as PromptVersion;
}
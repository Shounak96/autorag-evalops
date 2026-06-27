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

export interface CreatePromptPayload {
  name: string;
  description?: string | null;
  system_prompt: string;
  user_prompt_template: string;
  is_default: boolean;
}

export interface UpdatePromptPayload {
  name: string;
  description?: string | null;
  system_prompt: string;
  user_prompt_template: string;
}


export async function listPrompts(): Promise<PromptListResponse> {
  const response = await fetch(`${API_BASE_URL}/prompts`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to load prompts."),
    );
  }

  return (await response.json()) as PromptListResponse;
}

export async function createPrompt(
  payload: CreatePromptPayload,
): Promise<PromptVersion> {
  const response = await fetch(`${API_BASE_URL}/prompts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to create prompt."),
    );
  }

  return (await response.json()) as PromptVersion;
}

export async function updatePrompt(
  promptVersionId: string,
  payload: UpdatePromptPayload,
): Promise<PromptVersion> {
  const response = await fetch(
    `${API_BASE_URL}/prompts/${promptVersionId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to update prompt."),
    );
  }

  return (await response.json()) as PromptVersion;
}

export async function setDefaultPrompt(
  promptVersionId: string,
): Promise<{ message: string; prompt: PromptVersion }> {
  const response = await fetch(
    `${API_BASE_URL}/prompts/${promptVersionId}/default`,
    {
      method: "PATCH",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to set default prompt."),
    );
  }

  return (await response.json()) as {
    message: string;
    prompt: PromptVersion;
  };
}

export async function deletePrompt(
  promptVersionId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/prompts/${promptVersionId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response, "Unable to delete prompt."),
    );
  }
}


const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function apiGet<T>(
  endpoint: string,
  fallback: T,
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        `API request failed: ${endpoint} returned ${response.status}`,
      );

      return fallback;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);

    return fallback;
  }
}

export async function apiPost<TRequest, TResponse>(
  endpoint: string,
  payload: TRequest,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;

    try {
      const errorBody = (await response.json()) as {
        detail?: string;
      };

      if (errorBody.detail) {
        detail = errorBody.detail;
      }
    } catch {
      // Keep default error message if backend response is not JSON.
    }

    throw new Error(detail);
  }

  return (await response.json()) as TResponse;
}
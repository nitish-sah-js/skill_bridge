import type { ApiResult } from "./response";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** Browser-side fetch for our JSON API. Throws ApiClientError with a user-safe message. */
export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiClientError("Can't reach the server. Check your connection and try again.", "NETWORK", 0);
  }
  let body: ApiResult<T> | null = null;
  try {
    body = (await response.json()) as ApiResult<T>;
  } catch {
    // Non-JSON response (e.g. a platform error page).
  }
  if (!body) throw new ApiClientError("The server returned an unexpected response.", "BAD_RESPONSE", response.status);
  if (!body.ok) throw new ApiClientError(body.error.message, body.error.code, response.status, body.error.details);
  return body.data;
}

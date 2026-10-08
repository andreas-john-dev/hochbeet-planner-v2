/** Thrown for non-2xx API responses. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API request failed with HTTP ${String(status)}`);
    this.name = 'ApiError';
  }
}

export type TokenProvider = () => Promise<string | null>;

/**
 * Fetch wrapper for `/api/...` on the same domain. Sends the Cognito ID token as
 * Bearer token and parses JSON responses.
 */
export function createApiClient(getIdToken: TokenProvider, fetchFn: typeof fetch = fetch) {
  return async function apiFetch<T>(path: `/api/${string}`, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    const token = await getIdToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetchFn(path, { ...init, headers });
    const text = await response.text();
    const body: unknown = text ? JSON.parse(text) : undefined;
    if (!response.ok) throw new ApiError(response.status, body);
    return body as T;
  };
}

export type ApiFetch = ReturnType<typeof createApiClient>;

/** German message of a failed API call: the service's `message`, or a generic hint. */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  return 'Das hat nicht geklappt. Bitte versuche es noch einmal.';
}

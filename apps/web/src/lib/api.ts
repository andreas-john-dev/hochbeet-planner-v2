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

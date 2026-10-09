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

/** Query retry policy: client errors (4xx) are final, everything else gets three more tries. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 3;
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
    const body = parseBody(text);
    if (!response.ok) throw new ApiError(response.status, body);
    return body as T;
  };
}

/** JSON body, or undefined for empty and non-JSON bodies (e.g. a proxy's HTML error page). */
function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export type ApiFetch = ReturnType<typeof createApiClient>;

/**
 * German message of a failed API call: the service's `message` if it sent one, otherwise a
 * hint that matches the kind of failure.
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
    if (error.status === 401) return 'Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.';
    if (error.status === 403) return 'Dafür fehlt dir die Berechtigung.';
    if (error.status === 404) return 'Das gibt es nicht mehr. Bitte lade die Seite neu.';
    if (error.status >= 500) {
      return 'Der Server hat gerade ein Problem. Bitte versuche es gleich noch einmal.';
    }
  }
  // fetch rejects with a TypeError when the network is down.
  if (error instanceof TypeError) {
    return 'Keine Verbindung zum Server. Prüfe deine Internetverbindung und versuche es noch einmal.';
  }
  return 'Das hat nicht geklappt. Bitte versuche es noch einmal.';
}

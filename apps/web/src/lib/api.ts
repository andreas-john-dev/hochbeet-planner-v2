import { currentLanguage, i18n } from './i18n';

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

/** Language of the API's messages; the services answer in German without it. */
export type LanguageProvider = () => string;

/** Headers of every API call: ID token, language and, for a body, the JSON content type. */
async function requestHeaders(
  init: RequestInit,
  getIdToken: TokenProvider,
  getLanguage: LanguageProvider,
): Promise<Headers> {
  const headers = new Headers(init.headers);
  const token = await getIdToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', getLanguage());
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

/**
 * Fetch wrapper for `/api/...` on the same domain. Sends the Cognito ID token as
 * Bearer token and the app's language as `Accept-Language`, and parses JSON responses.
 */
export function createApiClient(
  getIdToken: TokenProvider,
  fetchFn: typeof fetch = fetch,
  getLanguage: LanguageProvider = currentLanguage,
) {
  return async function apiFetch<T>(path: `/api/${string}`, init: RequestInit = {}): Promise<T> {
    const headers = await requestHeaders(init, getIdToken, getLanguage);
    const response = await fetchFn(path, { ...init, headers });
    const text = await response.text();
    const body = parseBody(text);
    if (!response.ok) throw new ApiError(response.status, body);
    return body as T;
  };
}

/**
 * Like `createApiClient`, but resolves with the response itself so the caller can read a
 * stream (e.g. the assistant's server-sent events). Non-2xx responses still throw `ApiError`
 * with the parsed body.
 */
export function createApiStream(
  getIdToken: TokenProvider,
  fetchFn: typeof fetch = fetch,
  getLanguage: LanguageProvider = currentLanguage,
) {
  return async function apiStream(
    path: `/api/${string}`,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers = await requestHeaders(init, getIdToken, getLanguage);
    const response = await fetchFn(path, { ...init, headers });
    if (!response.ok) throw new ApiError(response.status, parseBody(await response.text()));
    return response;
  };
}

export type ApiStream = ReturnType<typeof createApiStream>;

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
 * Message of a failed API call: the service's `message` if it sent one, otherwise a hint in
 * the app's language that matches the kind of failure.
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
    if (error.status === 401) return i18n.t('apiError.unauthorized');
    if (error.status === 403) return i18n.t('apiError.forbidden');
    if (error.status === 404) return i18n.t('apiError.notFound');
    if (error.status === 429) return i18n.t('apiError.tooManyRequests');
    if (error.status >= 500) {
      return i18n.t('apiError.server');
    }
  }
  // fetch rejects with a TypeError when the network is down.
  if (error instanceof TypeError) {
    return i18n.t('apiError.offline');
  }
  return i18n.t('apiError.generic');
}

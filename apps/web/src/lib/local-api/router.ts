import {
  type ErrorKey,
  type ErrorResponse,
  type Locale,
  localeFromHeader,
  localizeIssues,
  localizeMessage,
  safeParseIn,
} from '@hochbeet/contracts';
import type { z } from 'zod';

export type RouteHandler = (args: {
  request: Request;
  params: Record<string, string>;
}) => Response | Promise<Response>;

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path with `:name` segments, e.g. `/api/garden/beds/:bedId`. */
  path: string;
  handler: RouteHandler;
}

export const route = (method: Route['method'], path: string, handler: RouteHandler): Route => ({
  method,
  path,
  handler,
});

/** Params of `path` if `pathname` matches it, segment by segment. */
function match(path: string, pathname: string): Record<string, string> | undefined {
  const expected = path.split('/');
  const actual = pathname.replace(/\/$/, '').split('/');
  if (expected.length !== actual.length) return undefined;
  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const value = actual[index] ?? '';
    if (segment.startsWith(':')) {
      if (!value) return undefined;
      params[segment.slice(1)] = decodeURIComponent(value);
    } else if (segment !== value) {
      return undefined;
    }
  }
  return params;
}

/** Thrown inside a route to answer with this status and the text of `key`. */
export class LocalApiError extends Error {
  constructor(
    readonly status: number,
    readonly key: ErrorKey,
  ) {
    super(key);
    this.name = 'LocalApiError';
  }
}

// The explicit type argument checks the body against its response contract.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const json = <T>(body: T, status = 200) => Response.json(body, { status });
export const noContent = () => new Response(null, { status: 204 });
/**
 * Error response like the services. `key` and keys in the issues (`messageKey()`) become
 * text in the request's language in `handle()`.
 */
export const error = (key: ErrorKey, status: number, issues?: ErrorResponse['issues']) =>
  errorText(key, status, issues);

/** Error response with a fixed text, e.g. one the assistant writes in German. */
export const errorText = (message: string, status: number, issues?: ErrorResponse['issues']) =>
  json<ErrorResponse>(issues ? { message, issues } : { message }, status);

/** Language of a request from `Accept-Language`, like in the services. */
export const requestLocale = (request: Request): Locale =>
  localeFromHeader(request.headers.get('Accept-Language'));

/** An error response with its keys as text in `locale`; other responses stay as they are. */
export async function localizeResponse(response: Response, locale: Locale): Promise<Response> {
  if (response.ok || !response.headers.get('Content-Type')?.includes('json')) return response;
  const body = (await response
    .clone()
    .json()
    .catch(() => undefined)) as Partial<ErrorResponse> | undefined;
  if (typeof body?.message !== 'string') return response;
  return errorText(
    localizeMessage(body.message, locale),
    response.status,
    body.issues?.map((i) => ({ path: i.path, message: localizeMessage(i.message, locale) })),
  );
}

/**
 * Request body checked against a contract schema, or a 400 in the services' error format with
 * Zod's default messages in the request's language.
 */
export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T>; response?: undefined } | { response: Response }> {
  const locale = requestLocale(request);
  const result = safeParseIn(schema, await request.json().catch(() => undefined), locale);
  return result.success
    ? { data: result.data }
    : {
        response: errorText(
          localizeMessage('checkInput', locale),
          400,
          localizeIssues(result.error, locale),
        ),
      };
}

/**
 * Answers `request` with the first matching route; 404 if none matches. A full browser storage
 * becomes a 507 instead of a rejected promise. Error messages are in the language of
 * `Accept-Language`, like in the services.
 */
export async function handle(routes: readonly Route[], request: Request): Promise<Response> {
  return localizeResponse(await dispatch(routes, request), requestLocale(request));
}

async function dispatch(routes: readonly Route[], request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  try {
    for (const r of routes) {
      if (r.method !== request.method) continue;
      const params = match(r.path, pathname);
      if (params) return await r.handler({ request, params });
    }
    return error('unknownPath', 404);
  } catch (cause) {
    if (cause instanceof LocalApiError) return error(cause.key, cause.status);
    if (cause instanceof DOMException && cause.name === 'QuotaExceededError') {
      return error('storageFull', 507);
    }
    return error('localFailed', 500);
  }
}

/** `fetch` arguments as a Request with an absolute URL. */
export function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
  return new Request(new URL(url, window.location.origin), init);
}

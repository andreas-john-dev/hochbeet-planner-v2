import type { ErrorResponse } from '@hochbeet/contracts';
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

/** Thrown inside a route to answer with this status and German message. */
export class LocalApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'LocalApiError';
  }
}

// The explicit type argument checks the body against its response contract.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const json = <T>(body: T, status = 200) => Response.json(body, { status });
export const noContent = () => new Response(null, { status: 204 });
export const error = (message: string, status: number, issues?: ErrorResponse['issues']) =>
  json<ErrorResponse>(issues ? { message, issues } : { message }, status);

/** Request body checked against a contract schema, or a 400 in the services' error format. */
export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T>; response?: undefined } | { response: Response }> {
  const result = schema.safeParse(await request.json().catch(() => undefined));
  return result.success
    ? { data: result.data }
    : {
        response: error(
          'Bitte prüfe deine Eingaben.',
          400,
          result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      };
}

/**
 * Answers `request` with the first matching route; 404 if none matches. A full browser storage
 * becomes a 507 with a German message instead of a rejected promise.
 */
export async function handle(routes: readonly Route[], request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  try {
    for (const r of routes) {
      if (r.method !== request.method) continue;
      const params = match(r.path, pathname);
      if (params) return await r.handler({ request, params });
    }
    return error('Diese Adresse gibt es nicht.', 404);
  } catch (cause) {
    if (cause instanceof LocalApiError) return error(cause.message, cause.status);
    if (cause instanceof DOMException && cause.name === 'QuotaExceededError') {
      return error(
        'Der Speicher deines Browsers ist voll. Lösche alte Beete und versuche es noch einmal.',
        507,
      );
    }
    return error('Das hat nicht geklappt. Bitte versuche es noch einmal.', 500);
  }
}

/** `fetch` arguments as a Request with an absolute URL. */
export function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
  return new Request(new URL(url, window.location.origin), init);
}

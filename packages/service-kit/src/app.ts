import {
  type ErrorKey,
  type ErrorResponse,
  type Locale,
  localeFromHeader,
  localizeMessage,
  safeParseIn,
} from '@hochbeet/contracts';
import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { type Issue, issuesOf, ServiceError, ValidationError } from './errors';
import { errorFields, type Logger } from './logger';
import { type ApiEvent, userFromEvent, type User } from './user';

// German default messages for schema errors without their own message ("Ungültige Option ...");
// parseBody() passes the caller's language for each parse.
z.config(z.locales.de());

/** Hono environment of every service: Lambda event binding, signed-in user and logger. */
export interface ServiceEnv {
  Bindings: { event?: ApiEvent };
  Variables: { user: User; logger: Logger };
}

/** Language of the caller from `Accept-Language`: `en` or German for everything else. */
export const requestLocale = (c: Context): Locale =>
  localeFromHeader(c.req.header('Accept-Language'));

/** Error body in `locale`; keys of the contracts in the message and the issues become text. */
export function errorBody(key: ErrorKey, locale: Locale, issues: Issue[] = []): ErrorResponse {
  const message = localizeMessage(key, locale);
  return issues.length > 0
    ? {
        message,
        issues: issues.map((i) => ({ path: i.path, message: localizeMessage(i.message, locale) })),
      }
    : { message };
}

/**
 * Routes under `<basePath>/public/` work without sign-in, e.g. the catalogue for guests.
 * API Gateway decides which of them are reachable without a token (one route each, without
 * authorizer); everything else there keeps the JWT authorizer. Public handlers never read
 * the user: there is none.
 */
export const PUBLIC_PREFIX = '/public/';

/**
 * Hono app for one service under `basePath` (CloudFront forwards the full path), with
 * the shared middleware: user context from the JWT claims of the API Gateway authorizer
 * (401 without, except for public routes), one structured log line per request, and error
 * responses in the language of `Accept-Language` (German by default).
 */
export function createServiceApp(basePath: string, logger: Logger) {
  const app = new Hono<ServiceEnv>().basePath(basePath);
  const isPublic = (path: string) => path.startsWith(`${basePath}${PUBLIC_PREFIX}`);

  app.use(async (c, next) => {
    const started = Date.now();
    // Without Lambda (tests, local) there are no bindings at all.
    const event = (c.env as ServiceEnv['Bindings'] | undefined)?.event;
    const requestId = event?.requestContext.requestId;
    const user = userFromEvent(event);
    const log = logger.child({ requestId, userId: user?.id });
    c.set('logger', log);
    try {
      // API Gateway rejects requests without a valid token; this is the second line of defence.
      if (user) c.set('user', user);
      else if (!isPublic(c.req.path)) {
        throw new ServiceError(401, 'signIn');
      }
      await next();
    } finally {
      log.info('request', {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Date.now() - started,
      });
    }
  });

  app.notFound((c) => c.json(errorBody('unknownPath', requestLocale(c)), 404));

  app.onError((error, c) => {
    const locale = requestLocale(c);
    if (error instanceof ServiceError) {
      return c.json(errorBody(error.key, locale, error.issues), error.status);
    }
    if (error instanceof HTTPException) {
      return c.json({ message: error.message } satisfies ErrorResponse, error.status);
    }
    ((c.get('logger') as Logger | undefined) ?? logger).error(
      'unhandled error',
      errorFields(error),
    );
    return c.json(errorBody('server', locale), 500);
  });

  return app;
}

/**
 * Parses the JSON body with a contract schema; 400 with field issues in the caller's
 * language otherwise.
 */
export async function parseBody<T extends z.ZodType>(
  c: Context<ServiceEnv>,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('invalidJson', []);
  }
  const result = safeParseIn(schema, body, requestLocale(c));
  if (!result.success) throw new ValidationError('checkInput', issuesOf(result.error));
  return result.data;
}

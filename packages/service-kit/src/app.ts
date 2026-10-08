import type { ErrorResponse } from '@hochbeet/contracts';
import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';
import { ConflictError, issuesOf, NotFoundError, ValidationError } from './errors';
import { errorFields, type Logger } from './logger';
import { type ApiEvent, userFromEvent, type User } from './user';

/** Hono environment of every service: Lambda event binding, signed-in user and logger. */
export interface ServiceEnv {
  Bindings: { event?: ApiEvent };
  Variables: { user: User; logger: Logger };
}

export const errorBody = (message: string): ErrorResponse => ({ message });

/**
 * Hono app for one service under `basePath` (CloudFront forwards the full path), with
 * the shared middleware: user context from the JWT claims of the API Gateway authorizer
 * (401 without), one structured log line per request, and German error responses.
 */
export function createServiceApp(basePath: string, logger: Logger) {
  const app = new Hono<ServiceEnv>().basePath(basePath);

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
      if (!user) throw new HTTPException(401, { message: 'Bitte melde dich an.' });
      c.set('user', user);
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

  app.notFound((c) => c.json(errorBody('Diese Adresse gibt es nicht.'), 404));

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json(errorBody(error.message), error.status);
    }
    if (error instanceof ValidationError) {
      const body: ErrorResponse =
        error.issues.length > 0
          ? { message: error.message, issues: error.issues }
          : errorBody(error.message);
      return c.json(body, 400);
    }
    if (error instanceof NotFoundError) return c.json(errorBody(error.message), 404);
    if (error instanceof ConflictError) return c.json(errorBody(error.message), 409);
    ((c.get('logger') as Logger | undefined) ?? logger).error(
      'unhandled error',
      errorFields(error),
    );
    return c.json(errorBody('Da ist etwas schiefgegangen. Bitte versuche es später erneut.'), 500);
  });

  return app;
}

/** Parses the JSON body with a contract schema; 400 with field issues otherwise. */
export async function parseBody<T extends z.ZodType>(
  c: Context<ServiceEnv>,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Die Anfrage ist kein gültiges JSON.', []);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Bitte prüfe deine Eingaben.', issuesOf(result.error));
  }
  return result.data;
}

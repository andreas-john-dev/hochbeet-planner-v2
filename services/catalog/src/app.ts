import {
  type ErrorResponse,
  type ListPlantsResponse,
  SaveOverrideRequestSchema,
  SavePlantRequestSchema,
} from '@hochbeet/contracts';
import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';
import { CatalogService, type CatalogStore } from './catalog/service';
import { issuesOf, NotFoundError, ValidationError } from './errors';
import { errorFields, type Logger } from './logger';
import { type ApiEvent, userFromEvent, type User } from './user';

export interface AppDeps {
  store: CatalogStore;
  logger: Logger;
  now?: () => Date;
  newId?: () => string;
}

interface Env {
  Bindings: { event?: ApiEvent };
  Variables: { user: User; logger: Logger };
}

/** API routes are served under /api/catalog: CloudFront forwards the full path. */
export const BASE_PATH = '/api/catalog';

const errorBody = (message: string): ErrorResponse => ({ message });

/** Parses the JSON body with a contract schema; 400 with field issues otherwise. */
async function parseBody<T extends z.ZodType>(c: Context<Env>, schema: T): Promise<z.infer<T>> {
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

export function createApp({ store, logger, now, newId }: AppDeps) {
  const app = new Hono<Env>().basePath(BASE_PATH);
  const catalog = new CatalogService(store, now, newId);

  // Request logging and the user context from the JWT claims of the API Gateway authorizer.
  app.use(async (c, next) => {
    const started = Date.now();
    // Without Lambda (tests, local) there are no bindings at all.
    const event = (c.env as Env['Bindings'] | undefined)?.event;
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

  app.get('/plants', async (c) => {
    const body: ListPlantsResponse = { plants: await catalog.list(c.get('user').id) };
    return c.json(body);
  });

  // Own plants: create, change, archive.
  app.post('/plants', async (c) => {
    const fields = await parseBody(c, SavePlantRequestSchema);
    return c.json(await catalog.createOwnPlant(c.get('user').id, fields), 201);
  });

  app.put('/plants/:id', async (c) => {
    const fields = await parseBody(c, SavePlantRequestSchema);
    return c.json(await catalog.updateOwnPlant(c.get('user').id, c.req.param('id'), fields));
  });

  app.delete('/plants/:id', async (c) => {
    await catalog.archiveOwnPlant(c.get('user').id, c.req.param('id'));
    return c.body(null, 204);
  });

  // Personal overrides of global plants.
  app.put('/plants/:id/override', async (c) => {
    const fields = await parseBody(c, SaveOverrideRequestSchema);
    return c.json(await catalog.saveOverride(c.get('user').id, c.req.param('id'), fields));
  });

  app.delete('/plants/:id/override', async (c) => {
    await catalog.resetOverride(c.get('user').id, c.req.param('id'));
    return c.body(null, 204);
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
    ((c.get('logger') as Logger | undefined) ?? logger).error(
      'unhandled error',
      errorFields(error),
    );
    return c.json(errorBody('Da ist etwas schiefgegangen. Bitte versuche es später erneut.'), 500);
  });

  return app;
}

export type CatalogApp = ReturnType<typeof createApp>;

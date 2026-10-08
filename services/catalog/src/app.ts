import type { ErrorResponse, ListPlantsResponse } from '@hochbeet/contracts';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { effectiveCatalog } from './catalog/effective';
import type { CatalogRepository } from './catalog/repository';
import { errorFields, type Logger } from './logger';
import { type ApiEvent, userFromEvent, type User } from './user';

export interface AppDeps {
  repository: Pick<CatalogRepository, 'listGlobalPlants' | 'listUserItems'>;
  logger: Logger;
}

interface Env {
  Bindings: { event?: ApiEvent };
  Variables: { user: User; logger: Logger };
}

/** API routes are served under /api/catalog: CloudFront forwards the full path. */
export const BASE_PATH = '/api/catalog';

const errorBody = (message: string): ErrorResponse => ({ message });

export function createApp({ repository, logger }: AppDeps) {
  const app = new Hono<Env>().basePath(BASE_PATH);

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
    const user = c.get('user');
    const [globals, { overrides, own }] = await Promise.all([
      repository.listGlobalPlants(),
      repository.listUserItems(user.id),
    ]);
    const body: ListPlantsResponse = { plants: effectiveCatalog(globals, overrides, own) };
    return c.json(body);
  });

  app.notFound((c) => c.json(errorBody('Diese Adresse gibt es nicht.'), 404));

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json(errorBody(error.message), error.status);
    }
    ((c.get('logger') as Logger | undefined) ?? logger).error(
      'unhandled error',
      errorFields(error),
    );
    return c.json(errorBody('Da ist etwas schiefgegangen. Bitte versuche es später erneut.'), 500);
  });

  return app;
}

export type CatalogApp = ReturnType<typeof createApp>;

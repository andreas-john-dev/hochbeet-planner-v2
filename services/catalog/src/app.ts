import {
  ApprovePublicationRequestSchema,
  ImportCatalogRequestSchema,
  type ListPlantsResponse,
  type ListPublicPlantsResponse,
  RejectPublicationRequestSchema,
  SaveOverrideRequestSchema,
  SavePlantRequestSchema,
} from '@hochbeet/contracts';
import { createServiceApp, isAdmin, type Logger, parseBody } from '@hochbeet/service-kit';
import { HTTPException } from 'hono/http-exception';
import { ulid } from 'ulid';
import { AdminService } from './catalog/admin';
import { importCatalog } from './catalog/import';
import { CatalogService, type CatalogStore } from './catalog/service';
import type { CatalogImportStore } from './catalog/import';

export interface AppDeps {
  store: CatalogStore & CatalogImportStore;
  logger: Logger;
  now?: () => Date;
  newId?: () => string;
}

/** API routes are served under /api/catalog: CloudFront forwards the full path. */
export const BASE_PATH = '/api/catalog';

/** Reachable without sign-in (API route without authorizer, cached by CloudFront). */
export const PUBLIC_PLANTS_PATH = `${BASE_PATH}/public/plants`;
/** How long browsers and CloudFront may keep the public catalogue. */
export const PUBLIC_MAX_AGE_SECONDS = 300;

export function createApp({ store, logger, now, newId = () => ulid() }: AppDeps) {
  const app = createServiceApp(BASE_PATH, logger);
  const catalog = new CatalogService(store, now, newId);
  const admin = new AdminService(store, newId);

  // Global plants only, for guests: no user, so no adjustments and no own plants.
  app.get('/public/plants', async (c) => {
    const body: ListPublicPlantsResponse = { plants: await catalog.listGlobal() };
    c.header('Cache-Control', `public, max-age=${String(PUBLIC_MAX_AGE_SECONDS)}`);
    return c.json(body);
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

  app.post('/plants/:id/publication', async (c) => {
    return c.json(await catalog.requestPublication(c.get('user').id, c.req.param('id')));
  });

  // A guest's own plants and adjustments after sign-in; idempotent per importId.
  app.post('/import', async (c) => {
    const request = await parseBody(c, ImportCatalogRequestSchema);
    return c.json(await importCatalog(store, c.get('user').id, request, newId));
  });

  // Admin area: members of the Cognito group `admins` only.
  app.use('/admin/*', async (c, next) => {
    if (!isAdmin(c.get('user'))) {
      throw new HTTPException(403, { message: 'Dieser Bereich ist nur für Admins.' });
    }
    await next();
  });

  app.get('/admin/publications', async (c) => c.json(await admin.queue()));

  app.post('/admin/publications/:id/approve', async (c) => {
    const request = await parseBody(c, ApprovePublicationRequestSchema);
    return c.json(await admin.approve(c.req.param('id'), request));
  });

  app.post('/admin/publications/:id/reject', async (c) => {
    const { comment } = await parseBody(c, RejectPublicationRequestSchema);
    await admin.reject(c.req.param('id'), comment);
    return c.body(null, 204);
  });

  app.post('/admin/plants', async (c) => {
    const fields = await parseBody(c, SavePlantRequestSchema);
    return c.json(await admin.createGlobalPlant(fields), 201);
  });

  app.put('/admin/plants/:id', async (c) => {
    const fields = await parseBody(c, SavePlantRequestSchema);
    return c.json(await admin.updateGlobalPlant(c.req.param('id'), fields));
  });

  return app;
}

export type CatalogApp = ReturnType<typeof createApp>;

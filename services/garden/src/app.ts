import {
  type Bed,
  type BedWithPlantingsResponse,
  type ListBedsResponse,
  SaveBedRequestSchema,
} from '@hochbeet/contracts';
import { createServiceApp, type Logger, NotFoundError, parseBody } from '@hochbeet/service-kit';
import { ulid } from 'ulid';
import type { GardenRepository } from './garden/repository';

export type GardenStore = Pick<
  GardenRepository,
  'listBeds' | 'getBedWithPlantings' | 'createBed' | 'replaceBed' | 'deleteBed' | 'putPlanting'
>;

export interface AppDeps {
  store: GardenStore;
  logger: Logger;
  newId?: () => string;
}

/** API routes are served under /api/garden: CloudFront forwards the full path. */
export const BASE_PATH = '/api/garden';

const BED_NOT_FOUND = 'Dieses Beet gibt es nicht.';

const byName = (a: Bed, b: Bed) => a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id);

export function createApp({ store, logger, newId = () => ulid() }: AppDeps) {
  const app = createServiceApp(BASE_PATH, logger);

  app.get('/beds', async (c) => {
    const body: ListBedsResponse = { beds: (await store.listBeds(c.get('user').id)).sort(byName) };
    return c.json(body);
  });

  app.post('/beds', async (c) => {
    const fields = await parseBody(c, SaveBedRequestSchema);
    const bed: Bed = { ...fields, id: newId() };
    await store.createBed(c.get('user').id, bed);
    return c.json(bed, 201);
  });

  app.get('/beds/:bedId', async (c) => {
    const found = await store.getBedWithPlantings(c.get('user').id, c.req.param('bedId'));
    if (!found) throw new NotFoundError(BED_NOT_FOUND);
    const body: BedWithPlantingsResponse = found;
    return c.json(body);
  });

  // Shrinking a bed keeps plantings outside; the rules report them as "Beetrand".
  app.put('/beds/:bedId', async (c) => {
    const fields = await parseBody(c, SaveBedRequestSchema);
    const bed: Bed = { ...fields, id: c.req.param('bedId') };
    if (!(await store.replaceBed(c.get('user').id, bed))) throw new NotFoundError(BED_NOT_FOUND);
    return c.json(bed);
  });

  app.delete('/beds/:bedId', async (c) => {
    if (!(await store.deleteBed(c.get('user').id, c.req.param('bedId')))) {
      throw new NotFoundError(BED_NOT_FOUND);
    }
    return c.body(null, 204);
  });

  return app;
}

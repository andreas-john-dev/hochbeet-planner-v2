import type {
  Bed,
  ErrorResponse,
  ListSowingsResponse,
  Planting,
  SowingBatch,
} from '@hochbeet/contracts';
import { createLogger } from '@hochbeet/service-kit';
import { authorized, startDynamoDbTable } from '@hochbeet/service-kit/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { gardenTable } from '../table';
import { GardenRepository } from './repository';

const USER_A = 'a1b2c3d4-0000-4000-8000-00000000000a';
const USER_B = 'a1b2c3d4-0000-4000-8000-00000000000b';
const TOMATO = '01J9ZQ3W8D6V2K5M7N8P9R0TMT';
const LETTUCE = '01J9ZQ3W8D6V2K5M7N8P9R0SA1';

const tomatoes = {
  plantId: TOMATO,
  sowDate: '2026-03-09',
  sownCount: 12,
  aliveCount: 12,
  stage: 'SOWN',
  location: 'Fensterbank Küche',
  plannedTransplantDate: '2026-05-18',
};

describe('/api/garden/sowings against DynamoDB Local', () => {
  let db: Awaited<ReturnType<typeof startDynamoDbTable>>;
  let app: ReturnType<typeof createApp>;

  const call = (userId: string, method: string, path: string, body?: unknown) =>
    app.request(
      `/api/garden${path}`,
      body === undefined
        ? { method }
        : { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
      authorized(userId),
    );
  const json = async <T>(response: Response | Promise<Response>) =>
    (await (await response).json()) as T;
  const listSowings = async (userId: string) =>
    (await json<ListSowingsResponse>(call(userId, 'GET', '/sowings'))).sowings;
  const createBed = (userId: string, name: string) =>
    json<Bed>(
      call(userId, 'POST', '/beds', {
        name,
        widthCm: 200,
        depthCm: 100,
        mainRowDirection: 'V',
        soilRenewals: [],
      }),
    );
  const createPlanting = (userId: string, bedId: string, fields: Record<string, unknown>) =>
    call(userId, 'POST', `/beds/${bedId}/plantings`, {
      plantId: TOMATO,
      origin: 'TRANSPLANT',
      kind: 'SINGLE',
      x: 20,
      y: 20,
      startDate: '2026-05-18',
      endDate: null,
      removedDate: null,
      ...fields,
    });

  beforeAll(async () => {
    db = await startDynamoDbTable(gardenTable, 'garden');
    app = createApp({
      store: new GardenRepository(db.client, db.tableName),
      logger: createLogger({}, () => undefined),
    });
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  it('creates, changes and deletes a batch', async () => {
    const created = await call(USER_A, 'POST', '/sowings', tomatoes);
    expect(created.status).toBe(201);
    const sowing = await json<SowingBatch>(created);
    const { id, ...fields } = sowing;
    expect(fields).toEqual(tomatoes);
    expect(id).toMatch(/^[0-9A-Z]{26}$/);
    expect(await listSowings(USER_A)).toEqual([{ sowing, plantings: [] }]);

    const { location: _, ...withoutLocation } = tomatoes;
    const changed = { ...withoutLocation, stage: 'PRICKED', aliveCount: 9, notes: '3 verkümmert' };
    const updated = await call(USER_A, 'PUT', `/sowings/${sowing.id}`, changed);
    expect(updated.status).toBe(200);
    expect(await json(updated)).toEqual({ ...changed, id: sowing.id });
    expect(await listSowings(USER_A)).toEqual([
      { sowing: { ...changed, id: sowing.id }, plantings: [] },
    ]);

    expect((await call(USER_A, 'DELETE', `/sowings/${sowing.id}`)).status).toBe(204);
    expect(await listSowings(USER_A)).toEqual([]);
    expect((await call(USER_A, 'DELETE', `/sowings/${sowing.id}`)).status).toBe(404);
    expect((await call(USER_A, 'PUT', `/sowings/${sowing.id}`, tomatoes)).status).toBe(404);
  });

  it('lists each batch with its plantings from all beds, sorted by sowing week', async () => {
    const lettuce = await json<SowingBatch>(
      call(USER_B, 'POST', '/sowings', {
        plantId: LETTUCE,
        sowDate: '2026-03-02',
        sownCount: 30,
        aliveCount: 24,
        stage: 'HARDENING',
      }),
    );
    const tomato = await json<SowingBatch>(call(USER_B, 'POST', '/sowings', tomatoes));
    const south = await createBed(USER_B, 'Süd');
    const north = await createBed(USER_B, 'Nord');
    const single = await json<Planting>(createPlanting(USER_B, south.id, { sowingId: tomato.id }));
    const row = await json<Planting>(
      createPlanting(USER_B, north.id, {
        plantId: LETTUCE,
        sowingId: lettuce.id,
        kind: 'ROW',
        orientation: 'V',
        lengthCm: 100,
        startDate: '2026-04-27',
      }),
    );
    // Bought seedlings and direct sowing belong to no batch.
    await createPlanting(USER_B, south.id, { x: 80 });
    await createPlanting(USER_B, north.id, { origin: 'DIRECT_SOW', x: 80 });

    expect(await listSowings(USER_B)).toEqual([
      {
        sowing: lettuce,
        plantings: [
          { id: row.id, bedId: north.id, kind: 'ROW', lengthCm: 100, startDate: '2026-04-27' },
        ],
      },
      {
        sowing: tomato,
        plantings: [{ id: single.id, bedId: south.id, kind: 'SINGLE', startDate: '2026-05-18' }],
      },
    ]);

    // Deleting a batch keeps its plantings and their sowingId; nothing lists them any more.
    expect((await call(USER_B, 'DELETE', `/sowings/${tomato.id}`)).status).toBe(204);
    expect((await listSowings(USER_B)).map((s) => s.sowing.id)).toEqual([lettuce.id]);
    const bed = await json<{ plantings: Planting[] }>(call(USER_B, 'GET', `/beds/${south.id}`));
    expect(bed.plantings.find((p) => p.id === single.id)?.sowingId).toBe(tomato.id);
  });

  it('keeps every user to their own batches', async () => {
    const [own] = await listSowings(USER_B);
    if (!own) throw new Error('no batch');
    expect((await listSowings(USER_A)).map((s) => s.sowing.id)).not.toContain(own.sowing.id);
    expect((await call(USER_A, 'PUT', `/sowings/${own.sowing.id}`, tomatoes)).status).toBe(404);
    expect((await call(USER_A, 'DELETE', `/sowings/${own.sowing.id}`)).status).toBe(404);
    expect(await listSowings(USER_B)).toContainEqual(own);
  });

  it('checks the structure with German messages', async () => {
    const response = await call(USER_A, 'POST', '/sowings', {
      ...tomatoes,
      sowDate: '2026-03-10',
      sownCount: 0,
      plannedTransplantDate: '2026-03-02',
    });
    expect(response.status).toBe(400);
    const body = await json<ErrorResponse>(response);
    expect(body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'sowDate', message: 'Muss ein Montag sein.' }),
        expect.objectContaining({ path: 'sownCount', message: '1 bis 9999 Stück angeben.' }),
      ]),
    );
  });

  it('links only planted out plantings to a batch', async () => {
    const bed = await createBed(USER_A, 'Test');
    const response = await createPlanting(USER_A, bed.id, {
      origin: 'DIRECT_SOW',
      sowingId: '01J9ZQ3W8D6V2K5M7N8P9R0SW1',
    });
    expect(response.status).toBe(400);
    expect((await json<ErrorResponse>(response)).issues).toEqual([
      expect.objectContaining({
        path: 'sowingId',
        message: 'Nur gepflanzte Pflanzungen stammen aus einer Anzucht.',
      }),
    ]);
  });
});

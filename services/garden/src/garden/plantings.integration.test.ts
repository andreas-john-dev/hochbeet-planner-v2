import type {
  Bed,
  BedWithPlantingsResponse,
  ErrorResponse,
  Planting,
  PlantingFields,
} from '@hochbeet/contracts';
import { createLogger } from '@hochbeet/service-kit';
import { authorized, startDynamoDbTable } from '@hochbeet/service-kit/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { gardenTable } from '../table';
import { GardenRepository } from './repository';

const USER_A = 'a1b2c3d4-0000-4000-8000-00000000000a';
const USER_B = 'a1b2c3d4-0000-4000-8000-00000000000b';
const TOMATO = '01M49THV00SZ6Q8R32BYJM5P2S';

const single = (extra: Partial<PlantingFields> = {}): PlantingFields =>
  ({
    kind: 'SINGLE',
    plantId: TOMATO,
    x: 30,
    y: 40,
    startDate: '2026-05-04',
    endDate: '2026-10-05',
    removedDate: null,
    ...extra,
  }) as PlantingFields;

const row = (extra: Record<string, unknown> = {}) => ({
  kind: 'ROW',
  plantId: TOMATO,
  x: 0,
  y: 50,
  orientation: 'H',
  lengthCm: 100,
  startDate: '2026-04-06',
  endDate: null,
  removedDate: null,
  ...extra,
});

// Plantings against DynamoDB Local: only the structure is validated.
describe('/api/garden/beds/{bedId}/plantings against DynamoDB Local', () => {
  let db: Awaited<ReturnType<typeof startDynamoDbTable>>;
  let app: ReturnType<typeof createApp>;
  let bed: Bed;

  const call = (userId: string, method: string, path: string, body?: unknown) =>
    app.request(
      `/api/garden${path}`,
      body === undefined
        ? { method }
        : { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
      authorized(userId),
    );
  const plant = async (fields: unknown, bedId = bed.id) => {
    const response = await call(USER_A, 'POST', `/beds/${bedId}/plantings`, fields);
    expect(response.status).toBe(201);
    return (await response.json()) as Planting;
  };
  const issues = async (response: Response) => {
    expect(response.status).toBe(400);
    return ((await response.json()) as ErrorResponse).issues ?? [];
  };
  const plantingsOf = async (bedId: string) =>
    ((await (await call(USER_A, 'GET', `/beds/${bedId}`)).json()) as BedWithPlantingsResponse)
      .plantings;

  beforeAll(async () => {
    db = await startDynamoDbTable(gardenTable, 'garden');
    app = createApp({
      store: new GardenRepository(db.client, db.tableName),
      logger: createLogger({}, () => undefined),
    });
    const response = await call(USER_A, 'POST', '/beds', {
      name: 'Testbeet',
      widthCm: 200,
      depthCm: 100,
      mainRowDirection: 'V',
      soilRenewals: [],
    });
    bed = (await response.json()) as Bed;
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  it('creates single plantings and rows and returns them with the bed', async () => {
    const tomato = await plant(single());
    expect(tomato).toMatchObject({ ...single(), bedId: bed.id });
    expect(tomato.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    const carrots = await plant(row());
    expect(carrots).toMatchObject({ kind: 'ROW', orientation: 'H', lengthCm: 100 });
    expect((await plantingsOf(bed.id)).map((p) => p.id)).toEqual(
      expect.arrayContaining([tomato.id, carrots.id]),
    );
  });

  it('saves a planting outside the bed: rule warnings never block saving', async () => {
    const outside = await plant(single({ x: 500, y: 300 }));
    expect(outside).toMatchObject({ x: 500, y: 300 });
    expect((await plantingsOf(bed.id)).some((p) => p.id === outside.id)).toBe(true);
  });

  it('rejects x = 7 with 400 and a German message', async () => {
    const response = await call(USER_A, 'POST', `/beds/${bed.id}/plantings`, single({ x: 7 }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'Bitte prüfe deine Eingaben.',
      issues: [{ path: 'x', message: 'Muss ein Vielfaches von 5 cm sein.' }],
    });
  });

  it('checks rows, dates and Mondays', async () => {
    expect(
      await issues(await call(USER_A, 'POST', `/beds/${bed.id}/plantings`, row({ lengthCm: 0 }))),
    ).toEqual([{ path: 'lengthCm', message: 'Mindestens 5 cm.' }]);
    const withoutOrientation = await issues(
      await call(USER_A, 'POST', `/beds/${bed.id}/plantings`, row({ orientation: undefined })),
    );
    expect(withoutOrientation.map((i) => i.path)).toEqual(['orientation']);
    expect(withoutOrientation[0]?.message).toMatch(/^Ungültig/);

    expect(
      await issues(
        await call(
          USER_A,
          'POST',
          `/beds/${bed.id}/plantings`,
          single({ startDate: '2026-05-05' }),
        ),
      ),
    ).toEqual([{ path: 'startDate', message: 'Muss ein Montag sein.' }]);
    expect(
      await issues(
        await call(USER_A, 'POST', `/beds/${bed.id}/plantings`, single({ endDate: '2026-05-04' })),
      ),
    ).toEqual([{ path: 'endDate', message: 'Ende muss nach dem Start liegen.' }]);
    expect(
      await issues(
        await call(
          USER_A,
          'POST',
          `/beds/${bed.id}/plantings`,
          single({ removedDate: '2026-06-02' }),
        ),
      ),
    ).toEqual([{ path: 'removedDate', message: 'Muss ein Montag sein.' }]);
    expect(
      await issues(
        await call(
          USER_A,
          'POST',
          `/beds/${bed.id}/plantings`,
          single({ removedDate: '2026-04-27' }),
        ),
      ),
    ).toEqual([{ path: 'removedDate', message: 'Entfernen darf nicht vor dem Start liegen.' }]);
  });

  it('moves, removes and deletes a planting', async () => {
    const planting = await plant(single());
    const moved = await call(USER_A, 'PUT', `/beds/${bed.id}/plantings/${planting.id}`, {
      ...single({ x: 120, removedDate: '2026-08-03' }),
    });
    expect(moved.status).toBe(200);
    expect((await plantingsOf(bed.id)).find((p) => p.id === planting.id)).toMatchObject({
      x: 120,
      removedDate: '2026-08-03',
    });

    expect((await call(USER_A, 'DELETE', `/beds/${bed.id}/plantings/${planting.id}`)).status).toBe(
      204,
    );
    expect((await plantingsOf(bed.id)).some((p) => p.id === planting.id)).toBe(false);
    expect((await call(USER_A, 'DELETE', `/beds/${bed.id}/plantings/${planting.id}`)).status).toBe(
      404,
    );
    expect(
      (await call(USER_A, 'PUT', `/beds/${bed.id}/plantings/${planting.id}`, single())).status,
    ).toBe(404);
  });

  it('only works on the own, existing beds', async () => {
    const unknownBed = '01J9ZQ3W8D6V2K5M7N8P9R0SZZ';
    expect((await call(USER_A, 'POST', `/beds/${unknownBed}/plantings`, single())).status).toBe(
      404,
    );
    expect((await call(USER_B, 'POST', `/beds/${bed.id}/plantings`, single())).status).toBe(404);

    const planting = await plant(single());
    const path = `/beds/${bed.id}/plantings/${planting.id}`;
    expect((await call(USER_B, 'PUT', path, single({ x: 0 }))).status).toBe(404);
    expect((await call(USER_B, 'DELETE', path)).status).toBe(404);
    expect((await plantingsOf(bed.id)).find((p) => p.id === planting.id)?.x).toBe(30);
  });
});

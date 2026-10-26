import type {
  BedWithPlantingsResponse,
  ErrorResponse,
  ImportGardenResponse,
  ListBedsResponse,
  ListSowingsResponse,
} from '@hochbeet/contracts';
import { createLogger } from '@hochbeet/service-kit';
import { authorized, startDynamoDbTable } from '@hochbeet/service-kit/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { gardenTable } from '../table';
import { GardenRepository } from './repository';

const USER_A = 'a1b2c3d4-0000-4000-8000-00000000000a';
const USER_B = 'a1b2c3d4-0000-4000-8000-00000000000b';
const GUEST_BED = '01J9ZQ3W8D6V2K5M7N8P9R0BDA';
const OWN_PLANT = '01J9ZQ3W8D6V2K5M7N8P9R0WN1';
const GUEST_SOWING = '01J9ZQ3W8D6V2K5M7N8P9R0SW1';
const DELETED_SOWING = '01J9ZQ3W8D6V2K5M7N8P9R0SW2';

const importBody = (importId: string) => ({
  importId,
  beds: [
    {
      id: GUEST_BED,
      name: 'Gastbeet',
      widthCm: 200,
      depthCm: 100,
      mainRowDirection: 'V',
      soilRenewals: ['2026-03-01'],
    },
  ],
  plantings: ['01J9ZQ3W8D6V2K5M7N8P9R0PA1', '01J9ZQ3W8D6V2K5M7N8P9R0PA2'].map((id, i) => ({
    id,
    bedId: GUEST_BED,
    kind: 'SINGLE',
    plantId: OWN_PLANT,
    // The second one as from an app version before `origin` existed.
    ...(i === 0 ? { origin: 'DIRECT_SOW' } : {}),
    x: 20 + i * 40,
    y: 20,
    startDate: '2026-05-04',
    endDate: null,
    removedDate: null,
  })),
});

describe('/api/garden/import against DynamoDB Local', () => {
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
  const listBeds = async (userId: string) =>
    ((await (await call(userId, 'GET', '/beds')).json()) as ListBedsResponse).beds;

  beforeAll(async () => {
    db = await startDynamoDbTable(gardenTable);
    app = createApp({
      store: new GardenRepository(db.client, db.tableName),
      logger: createLogger({ service: 'garden' }, () => undefined),
    });
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  it('imports beds and plantings with new ids and correct references, once per importId', async () => {
    const body = importBody('01J9ZQ3W8D6V2K5M7N8P9R0MP1');
    const response = await call(USER_A, 'POST', '/import', body);
    expect(response.status).toBe(200);
    const { bedIds } = (await response.json()) as ImportGardenResponse;
    const newBedId = bedIds[GUEST_BED] ?? '';
    expect(newBedId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(newBedId).not.toBe(GUEST_BED);

    const details = (await (
      await call(USER_A, 'GET', `/beds/${newBedId}`)
    ).json()) as BedWithPlantingsResponse;
    expect(details.bed).toMatchObject({ name: 'Gastbeet', soilRenewals: ['2026-03-01'] });
    expect(details.plantings).toHaveLength(2);
    for (const p of details.plantings) {
      expect(p).toMatchObject({ bedId: newBedId, plantId: OWN_PLANT });
      expect(body.plantings.map((g) => g.id)).not.toContain(p.id);
    }
    expect(details.plantings.map((p) => [p.x, p.origin]).sort()).toEqual([
      [20, 'DIRECT_SOW'],
      [60, 'TRANSPLANT'],
    ]);

    // The same import again: same answer, no duplicates.
    const again = await call(USER_A, 'POST', '/import', body);
    expect(await again.json()).toEqual({ bedIds });
    expect(await listBeds(USER_A)).toHaveLength(1);

    // A second import adds to the beds that are already there.
    await call(USER_A, 'POST', '/import', importBody('01J9ZQ3W8D6V2K5M7N8P9R0MP2'));
    expect(await listBeds(USER_A)).toHaveLength(2);
    expect(await listBeds(USER_B)).toEqual([]);
  });

  it('imports sowing batches and points plantings to the new ones', async () => {
    const sowing = {
      id: GUEST_SOWING,
      plantId: OWN_PLANT,
      sowDate: '2026-03-09',
      sownCount: 10,
      aliveCount: 8,
      stage: 'HARDENING',
      location: 'Fensterbank',
    };
    const guest = importBody('01J9ZQ3W8D6V2K5M7N8P9R0MP4');
    const [fromBatch, fromDeleted] = guest.plantings;
    const body = {
      ...guest,
      sowings: [sowing],
      plantings: [
        { ...fromBatch, origin: 'TRANSPLANT', sowingId: GUEST_SOWING },
        // The guest deleted this batch; the planting kept its id.
        { ...fromDeleted, sowingId: DELETED_SOWING },
      ],
    };
    const { bedIds } = (await (
      await call(USER_B, 'POST', '/import', body)
    ).json()) as ImportGardenResponse;
    const newBedId = bedIds[GUEST_BED] ?? '';

    const { sowings } = (await (
      await call(USER_B, 'GET', '/sowings')
    ).json()) as ListSowingsResponse;
    expect(sowings).toHaveLength(1);
    const [imported] = sowings;
    const { id: newSowingId, ...fields } = imported?.sowing ?? sowing;
    const { id: _, ...guestFields } = sowing;
    expect(fields).toEqual(guestFields);
    expect(newSowingId).not.toBe(GUEST_SOWING);
    expect(imported?.plantings).toEqual([
      expect.objectContaining({ bedId: newBedId, kind: 'SINGLE' }),
    ]);

    const details = (await (
      await call(USER_B, 'GET', `/beds/${newBedId}`)
    ).json()) as BedWithPlantingsResponse;
    const byX = Object.fromEntries(details.plantings.map((p) => [p.x, p]));
    expect(byX[20]?.sowingId).toBe(imported?.sowing.id);
    expect(imported?.plantings[0]?.id).toBe(byX[20]?.id);
    expect(byX[60]).not.toHaveProperty('sowingId');

    // Repeating the import adds no second batch.
    await call(USER_B, 'POST', '/import', body);
    const again = (await (await call(USER_B, 'GET', '/sowings')).json()) as ListSowingsResponse;
    expect(again.sowings).toEqual(sowings);
  });

  it('refuses plantings of beds that are not part of the import', async () => {
    const body = importBody('01J9ZQ3W8D6V2K5M7N8P9R0MP3');
    const response = await call(USER_A, 'POST', '/import', { ...body, beds: [] });
    expect(response.status).toBe(400);
    const error = (await response.json()) as ErrorResponse;
    expect(error.issues).toContainEqual({
      path: 'plantings.0.bedId',
      message: 'Dieses Beet fehlt im Import.',
    });
    expect(await listBeds(USER_A)).toHaveLength(2);
  });
});

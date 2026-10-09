import type {
  BedWithPlantingsResponse,
  ErrorResponse,
  ImportGardenResponse,
  ListBedsResponse,
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

    // The same import again: same answer, no duplicates.
    const again = await call(USER_A, 'POST', '/import', body);
    expect(await again.json()).toEqual({ bedIds });
    expect(await listBeds(USER_A)).toHaveLength(1);

    // A second import adds to the beds that are already there.
    await call(USER_A, 'POST', '/import', importBody('01J9ZQ3W8D6V2K5M7N8P9R0MP2'));
    expect(await listBeds(USER_A)).toHaveLength(2);
    expect(await listBeds(USER_B)).toEqual([]);
  });

  it('refuses plantings of beds that are not part of the import', async () => {
    const body = importBody('01J9ZQ3W8D6V2K5M7N8P9R0MP3');
    const response = await call(USER_B, 'POST', '/import', { ...body, beds: [] });
    expect(response.status).toBe(400);
    const error = (await response.json()) as ErrorResponse;
    expect(error.issues).toContainEqual({
      path: 'plantings.0.bedId',
      message: 'Dieses Beet fehlt im Import.',
    });
    expect(await listBeds(USER_B)).toEqual([]);
  });
});

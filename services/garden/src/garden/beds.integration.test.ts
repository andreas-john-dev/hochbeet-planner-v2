import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type {
  Bed,
  BedFields,
  BedWithPlantingsResponse,
  ErrorResponse,
  ListBedsResponse,
  Planting,
} from '@hochbeet/contracts';
import { createLogger } from '@hochbeet/service-kit';
import { authorized, startDynamoDbTable } from '@hochbeet/service-kit/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { gardenTable, userPk } from '../table';
import { GardenRepository } from './repository';

const USER_A = 'a1b2c3d4-0000-4000-8000-00000000000a';
const USER_B = 'a1b2c3d4-0000-4000-8000-00000000000b';
const TOMATO = '01M49THV00SZ6Q8R32BYJM5P2S';

const bedFields = (name: string, extra: Partial<BedFields> = {}): BedFields => ({
  name,
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'V',
  soilRenewals: ['2026-03-01'],
  ...extra,
});

// Beds against DynamoDB Local.
describe('/api/garden/beds against DynamoDB Local', () => {
  let db: Awaited<ReturnType<typeof startDynamoDbTable>>;
  let app: ReturnType<typeof createApp>;
  let repository: GardenRepository;

  const call = (userId: string, method: string, path: string, body?: unknown) =>
    app.request(
      `/api/garden${path}`,
      body === undefined
        ? { method }
        : { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
      authorized(userId),
    );
  const create = async (userId: string, fields: BedFields) => {
    const response = await call(userId, 'POST', '/beds', fields);
    expect(response.status).toBe(201);
    return (await response.json()) as Bed;
  };
  const listBeds = async (userId: string) =>
    ((await (await call(userId, 'GET', '/beds')).json()) as ListBedsResponse).beds;
  const planting = (bedId: string, n: number): Planting => ({
    id: `01J9ZQ3W8D6V2K5M7N8P9R${String(n).padStart(4, '0')}`,
    bedId,
    plantId: TOMATO,
    kind: 'SINGLE',
    x: (n % 20) * 10,
    y: 50,
    startDate: '2026-05-04',
    endDate: null,
    removedDate: null,
  });
  const itemsOfBed = async (userId: string, bedId: string) =>
    (
      await db.client.send(
        new QueryCommand({
          TableName: db.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': userPk(userId), ':sk': `BED#${bedId}` },
        }),
      )
    ).Items ?? [];

  beforeAll(async () => {
    db = await startDynamoDbTable(gardenTable, 'garden');
    repository = new GardenRepository(db.client, db.tableName);
    app = createApp({ store: repository, logger: createLogger({}, () => undefined) });
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  it('answers 401 without token claims', async () => {
    expect((await app.request('/api/garden/beds')).status).toBe(401);
  });

  it('creates, reads and changes a bed with row direction and soil renewals', async () => {
    const bed = await create(USER_A, bedFields('Hochbeet Süd'));
    expect(bed).toMatchObject({ name: 'Hochbeet Süd', mainRowDirection: 'V' });
    expect(bed.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const read = await call(USER_A, 'GET', `/beds/${bed.id}`);
    expect(await read.json()).toEqual({ bed, plantings: [] });

    const changed = bedFields('Hochbeet Süd', {
      widthCm: 150,
      mainRowDirection: 'H',
      soilRenewals: ['2026-03-01', '2027-03-15'],
    });
    const updated = await call(USER_A, 'PUT', `/beds/${bed.id}`, changed);
    expect(updated.status).toBe(200);
    expect(await updated.json()).toEqual({ ...changed, id: bed.id });
    expect((await listBeds(USER_A)).find((b) => b.id === bed.id)).toEqual({
      ...changed,
      id: bed.id,
    });
  });

  it('lists the beds sorted by name', async () => {
    await create(USER_A, bedFields('Zweites Beet'));
    await create(USER_A, bedFields('Anzuchtbeet'));
    const names = (await listBeds(USER_A)).map((b) => b.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'de')));
    expect(names).toContain('Anzuchtbeet');
  });

  it('rejects invalid beds with German issues', async () => {
    const response = await call(USER_A, 'POST', '/beds', bedFields('', { widthCm: 203 }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.issues?.map((i) => i.path)).toEqual(expect.arrayContaining(['name', 'widthCm']));
  });

  it('never shows, changes or deletes the beds of another user', async () => {
    const bed = await create(USER_A, bedFields('Nur meins'));
    expect((await listBeds(USER_B)).some((b) => b.id === bed.id)).toBe(false);
    expect((await call(USER_B, 'GET', `/beds/${bed.id}`)).status).toBe(404);
    expect((await call(USER_B, 'PUT', `/beds/${bed.id}`, bedFields('Gekapert'))).status).toBe(404);
    expect((await call(USER_B, 'DELETE', `/beds/${bed.id}`)).status).toBe(404);

    const mine = (await (
      await call(USER_A, 'GET', `/beds/${bed.id}`)
    ).json()) as BedWithPlantingsResponse;
    expect(mine.bed.name).toBe('Nur meins');
    // B's PUT must not have created a bed under B either.
    expect(await listBeds(USER_B)).toEqual([]);
  });

  it('deletes a bed together with all its plantings', async () => {
    const bed = await create(USER_A, bedFields('Abräumen'));
    const other = await create(USER_A, bedFields('Bleibt'));
    // More plantings than one round of parallel deletes (25).
    for (let n = 0; n < 30; n++) await repository.putPlanting(USER_A, planting(bed.id, n));
    await repository.putPlanting(USER_A, planting(other.id, 99));

    const full = (await (
      await call(USER_A, 'GET', `/beds/${bed.id}`)
    ).json()) as BedWithPlantingsResponse;
    expect(full.plantings).toHaveLength(30);

    expect((await call(USER_A, 'DELETE', `/beds/${bed.id}`)).status).toBe(204);
    expect(await itemsOfBed(USER_A, bed.id)).toEqual([]);
    expect((await call(USER_A, 'GET', `/beds/${bed.id}`)).status).toBe(404);
    expect((await call(USER_A, 'DELETE', `/beds/${bed.id}`)).status).toBe(404);

    const kept = (await (
      await call(USER_A, 'GET', `/beds/${other.id}`)
    ).json()) as BedWithPlantingsResponse;
    expect(kept.plantings.map((p) => p.id)).toEqual([planting(other.id, 99).id]);
  });
});

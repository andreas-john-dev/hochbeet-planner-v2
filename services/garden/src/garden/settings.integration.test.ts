import type { ErrorResponse, GardenSettings, ListBedsResponse } from '@hochbeet/contracts';
import { createLogger } from '@hochbeet/service-kit';
import { authorized, startDynamoDbTable } from '@hochbeet/service-kit/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { gardenTable } from '../table';
import { GardenRepository } from './repository';

const USER_A = 'a1b2c3d4-0000-4000-8000-00000000000a';
const USER_B = 'a1b2c3d4-0000-4000-8000-00000000000b';

describe('/api/garden/settings against DynamoDB Local', () => {
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
  const settingsOf = async (userId: string) => {
    const response = await call(userId, 'GET', '/settings');
    expect(response.status).toBe(200);
    return (await response.json()) as GardenSettings;
  };

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

  it('returns the defaults while nothing is saved', async () => {
    expect(await settingsOf(USER_A)).toEqual({ lastFrost: '05-15' });
  });

  it('saves and overwrites the last frost, only for the caller', async () => {
    const saved = await call(USER_A, 'PUT', '/settings', { lastFrost: '04-20' });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ lastFrost: '04-20' });
    expect(await settingsOf(USER_A)).toEqual({ lastFrost: '04-20' });

    await call(USER_A, 'PUT', '/settings', { lastFrost: '05-25' });
    expect(await settingsOf(USER_A)).toEqual({ lastFrost: '05-25' });
    // Another user still has the defaults; the settings are not a bed of anyone.
    expect(await settingsOf(USER_B)).toEqual({ lastFrost: '05-15' });
    const beds = (await (await call(USER_A, 'GET', '/beds')).json()) as ListBedsResponse;
    expect(beds.beds).toEqual([]);
  });

  it('refuses days that are not in every year with a German message', async () => {
    const response = await call(USER_A, 'PUT', '/settings', { lastFrost: '02-29' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.issues).toEqual([
      expect.objectContaining({
        path: 'lastFrost',
        message: 'Diesen Tag gibt es nicht in jedem Jahr.',
      }),
    ]);
    expect(await settingsOf(USER_A)).toEqual({ lastFrost: '05-25' });
  });
});

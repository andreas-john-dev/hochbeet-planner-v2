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

  const call = (userId: string, method: string, path: string, body?: unknown, language?: string) =>
    app.request(
      `/api/garden${path}`,
      {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(language ? { 'Accept-Language': language } : {}),
        },
      },
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

  it('answers in English with Accept-Language: en and in German without', async () => {
    const english = await call(USER_A, 'PUT', '/settings', { lastFrost: '02-29' }, 'en-GB,en');
    expect(english.status).toBe(400);
    expect(await english.json()).toEqual({
      message: 'Please check your entries.',
      issues: [{ path: 'lastFrost', message: 'This day does not exist in every year.' }],
    });
    const german = await call(USER_A, 'PUT', '/settings', { lastFrost: 5 });
    expect(await german.json()).toEqual({
      message: 'Bitte prüfe deine Eingaben.',
      issues: [
        { path: 'lastFrost', message: expect.stringMatching(/^Ungültige Eingabe/) as string },
      ],
    });
    const zod = await call(USER_A, 'PUT', '/settings', { lastFrost: 5 }, 'en');
    expect(((await zod.json()) as ErrorResponse).issues?.[0]?.message).toMatch(/^Invalid input/);
    const missing = await call(USER_A, 'GET', '/beds/01J9ZQ3W8D6V2K5M7N8P9R0S1T', undefined, 'en');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ message: 'This bed does not exist.' });
    const germanMissing = await call(USER_A, 'GET', '/beds/01J9ZQ3W8D6V2K5M7N8P9R0S1T');
    expect(await germanMissing.json()).toEqual({ message: 'Dieses Beet gibt es nicht.' });
  });
});

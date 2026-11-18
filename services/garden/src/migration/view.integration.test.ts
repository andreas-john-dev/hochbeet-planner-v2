import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { GardenSettings } from '@hochbeet/contracts';
import { createLogger } from '@hochbeet/service-kit';
import { authorized, startDynamoDbTable } from '@hochbeet/service-kit/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { GardenRepository } from '../garden/repository';
import { gardenTable, importSk, plantingSk, SETTINGS_SK, sowingSk, userPk, bedSk } from '../table';
import { migrateViews } from './view';

const WITH_BED = 'a1b2c3d4-0000-4000-8000-00000000000a';
const WITH_SOWING = 'a1b2c3d4-0000-4000-8000-00000000000b';
const WITH_SETTINGS = 'a1b2c3d4-0000-4000-8000-00000000000c';
const WITH_VIEW = 'a1b2c3d4-0000-4000-8000-00000000000d';
const WITHOUT_DATA = 'a1b2c3d4-0000-4000-8000-00000000000e';
const BED = '01J9ZQ3W8D6V2K5M7N8P9R0BDA';

describe('view migration against DynamoDB Local', () => {
  let db: Awaited<ReturnType<typeof startDynamoDbTable>>;
  let app: ReturnType<typeof createApp>;

  const put = (userId: string, SK: string, fields: Record<string, unknown> = {}) =>
    db.client.send(
      new PutCommand({ TableName: db.tableName, Item: { PK: userPk(userId), SK, ...fields } }),
    );
  const settingsOf = async (userId: string) =>
    (await (
      await app.request('/api/garden/settings', { method: 'GET' }, authorized(userId))
    ).json()) as GardenSettings;

  beforeAll(async () => {
    db = await startDynamoDbTable(gardenTable, 'garden');
    app = createApp({
      store: new GardenRepository(db.client, db.tableName),
      logger: createLogger({}, () => undefined),
    });
    // Stored shapes do not matter here: the migration only looks at the keys.
    await put(WITH_BED, bedSk(BED), { name: 'Hochbeet' });
    await put(WITH_BED, plantingSk(BED, '01J9ZQ3W8D6V2K5M7N8P9R0PA1'));
    await put(WITH_SOWING, sowingSk('01J9ZQ3W8D6V2K5M7N8P9R0SW1'));
    await put(WITH_SETTINGS, SETTINGS_SK, { lastFrost: '04-20' });
    await put(WITH_VIEW, SETTINGS_SK, { lastFrost: '05-01', view: 'SIMPLE' });
    await put(WITH_VIEW, bedSk(BED));
    // A record of an import that wrote nothing is no data of its own.
    await put(WITHOUT_DATA, importSk('01J9ZQ3W8D6V2K5M7N8P9R0MP1'), { ids: {} });
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  it('moves users with data to the expert view and leaves everyone else alone', async () => {
    expect(await migrateViews(db.client, db.tableName)).toEqual({ expert: 3, unchanged: 1 });

    expect(await settingsOf(WITH_BED)).toEqual({ lastFrost: '05-15', view: 'EXPERT' });
    expect(await settingsOf(WITH_SOWING)).toEqual({ lastFrost: '05-15', view: 'EXPERT' });
    // A saved last frost stays.
    expect(await settingsOf(WITH_SETTINGS)).toEqual({ lastFrost: '04-20', view: 'EXPERT' });
    // A view that is already set is never overwritten.
    expect(await settingsOf(WITH_VIEW)).toEqual({ lastFrost: '05-01', view: 'SIMPLE' });
    // Without data there are still no settings: the user starts simple.
    expect(await new GardenRepository(db.client, db.tableName).getSettings(WITHOUT_DATA)).toBe(
      undefined,
    );
    expect(await settingsOf(WITHOUT_DATA)).toEqual({ lastFrost: '05-15', view: 'SIMPLE' });
  });

  it('changes nothing when it runs a second time', async () => {
    // The user switched to simple after the first run.
    await app.request(
      '/api/garden/settings',
      {
        method: 'PUT',
        body: JSON.stringify({ lastFrost: '05-15', view: 'SIMPLE' }),
        headers: { 'Content-Type': 'application/json' },
      },
      authorized(WITH_BED),
    );
    expect(await migrateViews(db.client, db.tableName)).toEqual({ expert: 0, unchanged: 4 });
    expect(await settingsOf(WITH_BED)).toEqual({ lastFrost: '05-15', view: 'SIMPLE' });
    expect(await settingsOf(WITH_SETTINGS)).toEqual({ lastFrost: '04-20', view: 'EXPERT' });
  });
});

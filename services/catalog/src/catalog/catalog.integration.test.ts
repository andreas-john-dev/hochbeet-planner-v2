import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { ListPlantsResponse } from '@hochbeet/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createLogger } from '../logger';
import { writeSeed } from '../seed/handler';
import { seedItems } from '../seed/items';
import { overrideSk, plantSk, userPk } from '../table';
import { startCatalogTable } from '../test/dynamodb-local';
import { authorized, ownPlant, seedPlant, USER_A, USER_B } from '../test/fixtures';
import { CatalogRepository } from './repository';

// Integration test: real DynamoDB Local in Docker, seeded like prod by the seed handler.
describe('GET /api/catalog/plants against DynamoDB Local', () => {
  let db: Awaited<ReturnType<typeof startCatalogTable>>;
  let app: ReturnType<typeof createApp>;
  const tomato = seedPlant('Tomate');

  const put = (item: Record<string, unknown>) =>
    db.client.send(new PutCommand({ TableName: db.tableName, Item: item }));

  const list = async (userId: string) => {
    const response = await app.request('/api/catalog/plants', {}, authorized(userId));
    expect(response.status).toBe(200);
    return ((await response.json()) as ListPlantsResponse).plants;
  };

  beforeAll(async () => {
    db = await startCatalogTable();
    await writeSeed(db.client, db.tableName, seedItems());
    await put({
      PK: userPk(USER_A),
      SK: overrideSk(tomato.id),
      plantId: tomato.id,
      fields: { spacingInRowCm: 45 },
    });
    const own = ownPlant('01J9ZQ3W8D6V2K5M7N8P9R0S1A', 'Zitronenmelisse');
    await put({ PK: userPk(USER_A), SK: plantSk(own.id), ...own, publicationStatus: 'PENDING' });
    const archived = ownPlant('01J9ZQ3W8D6V2K5M7N8P9R0S1B', 'Alte Sorte');
    await put({ PK: userPk(USER_A), SK: plantSk(archived.id), ...archived, archived: true });
    const otherUsers = ownPlant('01J9ZQ3W8D6V2K5M7N8P9R0S1C', 'Andenbeere');
    await put({ PK: userPk(USER_B), SK: plantSk(otherUsers.id), ...otherUsers });
    app = createApp({
      store: new CatalogRepository(db.client, db.tableName),
      logger: createLogger({}, () => undefined),
    });
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  it('returns all 56 global plants plus the own plants of the user', async () => {
    const plants = await list(USER_A);
    expect(plants.filter((p) => p.source === 'GLOBAL')).toHaveLength(56);
    expect(plants.filter((p) => p.source === 'OWN').map((p) => p.name)).toEqual([
      'Zitronenmelisse',
    ]);
  });

  it('applies the personal override and marks the plant', async () => {
    const plants = await list(USER_A);
    expect(plants.find((p) => p.id === tomato.id)).toMatchObject({
      spacingInRowCm: 45,
      rowSpacingCm: tomato.rowSpacingCm,
      overridden: true,
    });
    expect(plants.filter((p) => p.overridden)).toHaveLength(1);
  });

  it('marks own plants with their publication status and hides archived ones', async () => {
    const plants = await list(USER_A);
    expect(plants.find((p) => p.name === 'Zitronenmelisse')).toMatchObject({
      source: 'OWN',
      overridden: false,
      publication: { status: 'PENDING' },
    });
    expect(plants.some((p) => p.name === 'Alte Sorte')).toBe(false);
  });

  it('never shows overrides or own plants of other users', async () => {
    const plants = await list(USER_B);
    expect(plants.find((p) => p.id === tomato.id)).toMatchObject({
      spacingInRowCm: tomato.spacingInRowCm,
      overridden: false,
    });
    expect(plants.filter((p) => p.source === 'OWN').map((p) => p.name)).toEqual(['Andenbeere']);
  });

  it('strips storage attributes from the response', async () => {
    const [plant] = await list(USER_A);
    expect(plant).not.toHaveProperty('PK');
    expect(plant).not.toHaveProperty('SK');
    expect(plant).not.toHaveProperty('seedHash');
  });

  it('answers 401 without token claims', async () => {
    const response = await app.request('/api/catalog/plants');
    expect(response.status).toBe(401);
  });
});

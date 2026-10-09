import type { ImportCatalogResponse, ListPlantsResponse } from '@hochbeet/contracts';
import { createLogger } from '@hochbeet/service-kit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { writeSeed } from '../seed/handler';
import { seedItems } from '../seed/items';
import { startCatalogTable } from '../test/dynamodb-local';
import { authorized, ownPlant, seedPlant, USER_A, USER_B } from '../test/fixtures';
import { CatalogRepository } from './repository';

const GUEST_PLANT = '01J9ZQ3W8D6V2K5M7N8P9R0WNA';

describe('/api/catalog/import against DynamoDB Local', () => {
  let db: Awaited<ReturnType<typeof startCatalogTable>>;
  let app: ReturnType<typeof createApp>;
  const tomato = seedPlant('Tomate');
  const basil = seedPlant('Basilikum');

  const call = (userId: string, method: string, path: string, body?: unknown) =>
    app.request(
      `/api/catalog${path}`,
      body === undefined
        ? { method }
        : { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
      authorized(userId),
    );
  const list = async (userId: string) =>
    ((await (await call(userId, 'GET', '/plants')).json()) as ListPlantsResponse).plants;

  beforeAll(async () => {
    db = await startCatalogTable();
    await writeSeed(db.client, db.tableName, seedItems());
    app = createApp({
      store: new CatalogRepository(db.client, db.tableName),
      logger: createLogger({}, () => undefined),
    });
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  it('imports own plants with new ids and adjustments, once per importId', async () => {
    // The user already adjusted basil; the import must not replace that.
    await call(USER_A, 'PUT', `/plants/${basil.id}/override`, { spacingInRowCm: 40 });
    const body = {
      importId: '01J9ZQ3W8D6V2K5M7N8P9R0MP1',
      ownPlants: [{ ...ownPlant(GUEST_PLANT, 'Haferwurzel'), goodNeighbors: [tomato.id] }],
      overrides: [
        { plantId: tomato.id, fields: { spacingInRowCm: 70 } },
        { plantId: basil.id, fields: { spacingInRowCm: 15 } },
      ],
    };
    const response = await call(USER_A, 'POST', '/import', body);
    expect(response.status).toBe(200);
    const { plantIds } = (await response.json()) as ImportCatalogResponse;
    const newId = plantIds[GUEST_PLANT] ?? '';
    expect(newId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(newId).not.toBe(GUEST_PLANT);

    const plants = await list(USER_A);
    expect(plants.find((p) => p.id === newId)).toMatchObject({
      name: 'Haferwurzel',
      source: 'OWN',
      goodNeighbors: [tomato.id],
      publication: { status: 'PRIVATE' },
    });
    expect(plants.find((p) => p.id === tomato.id)).toMatchObject({ spacingInRowCm: 70 });
    expect(plants.find((p) => p.id === basil.id)).toMatchObject({ spacingInRowCm: 40 });

    const again = await call(USER_A, 'POST', '/import', body);
    expect(await again.json()).toEqual({ plantIds });
    expect((await list(USER_A)).filter((p) => p.source === 'OWN')).toHaveLength(1);
    expect((await list(USER_B)).filter((p) => p.source === 'OWN')).toEqual([]);
  });

  it('answers 400 for too many plants', async () => {
    const ownPlants = Array.from({ length: 201 }, (_, i) =>
      ownPlant(`01J9ZQ3W8D6V2K5M7N8P9R${String(i).padStart(4, '0')}`, `Sorte ${String(i)}`),
    );
    const response = await call(USER_B, 'POST', '/import', {
      importId: '01J9ZQ3W8D6V2K5M7N8P9R0MP2',
      ownPlants,
      overrides: [],
    });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain('Höchstens 200 eigene Sorten');
  });
});

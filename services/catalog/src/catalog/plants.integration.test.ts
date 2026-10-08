import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type {
  CatalogPlant,
  ErrorResponse,
  ListPlantsResponse,
  PlantFields,
} from '@hochbeet/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createLogger } from '@hochbeet/service-kit';
import { writeSeed } from '../seed/handler';
import { seedItems } from '../seed/items';
import { plantSk, userPk } from '../table';
import { startCatalogTable } from '../test/dynamodb-local';
import { authorized, seedPlant, USER_A, USER_B } from '../test/fixtures';
import { CatalogRepository } from './repository';

// Own plants and personal overrides against DynamoDB Local.
describe('own plants and overrides against DynamoDB Local', () => {
  let db: Awaited<ReturnType<typeof startCatalogTable>>;
  let app: ReturnType<typeof createApp>;
  const tomato = seedPlant('Tomate');
  const basil = seedPlant('Basilikum');

  const fields = (name: string, extra: Partial<PlantFields> = {}): PlantFields => {
    const { id: _id, ...rest } = seedPlant('Erdbeere');
    return { ...rest, name, goodNeighbors: [], badNeighbors: [], ...extra };
  };

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

  const create = async (userId: string, body: PlantFields) => {
    const response = await call(userId, 'POST', '/plants', body);
    expect(response.status).toBe(201);
    return (await response.json()) as CatalogPlant;
  };

  beforeAll(async () => {
    db = await startCatalogTable();
    await writeSeed(db.client, db.tableName, seedItems());
    app = createApp({
      store: new CatalogRepository(db.client, db.tableName),
      logger: createLogger({}, () => undefined),
      now: () => new Date('2026-10-07T10:00:00Z'),
    });
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  describe('own plants', () => {
    it('creates a private own plant with a new ULID', async () => {
      const plant = await create(USER_A, fields('Walderdbeere'));
      expect(plant).toMatchObject({
        name: 'Walderdbeere',
        source: 'OWN',
        overridden: false,
        publication: { status: 'PRIVATE' },
      });
      expect(plant.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect((await list(USER_A)).map((p) => p.id)).toContain(plant.id);
      expect((await list(USER_B)).map((p) => p.id)).not.toContain(plant.id);
    });

    it('rejects invalid fields with German issues', async () => {
      const response = await call(USER_A, 'POST', '/plants', { ...fields(''), spacingInRowCm: 0 });
      expect(response.status).toBe(400);
      const body = (await response.json()) as ErrorResponse;
      expect(body.message).toBe('Bitte prüfe deine Eingaben.');
      expect(body.issues?.map((i) => i.path)).toEqual(
        expect.arrayContaining(['name', 'spacingInRowCm']),
      );
    });

    it('rejects a body that is not JSON', async () => {
      const response = await app.request(
        '/api/catalog/plants',
        { method: 'POST', body: '{nope', headers: { 'Content-Type': 'application/json' } },
        authorized(USER_A),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ message: 'Die Anfrage ist kein gültiges JSON.' });
    });

    it('lets own plants name global and own plants as neighbours, nothing else', async () => {
      const mint = await create(USER_A, fields('Bergminze'));
      const plant = await create(
        USER_A,
        fields('Zitronenthymian', { goodNeighbors: [tomato.id, mint.id] }),
      );
      expect(plant.goodNeighbors).toEqual([tomato.id, mint.id]);

      const otherUsersPlant = await create(USER_B, fields('Fremde Sorte'));
      const response = await call(
        USER_A,
        'POST',
        '/plants',
        fields('Kaputt', { badNeighbors: [otherUsersPlant.id] }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: 'Bitte prüfe die Nachbarn.',
        issues: [{ path: 'badNeighbors.0', message: 'Unbekannte Sorte.' }],
      });
    });

    it('changes an own plant and keeps its publication status', async () => {
      const plant = await create(USER_A, fields('Monatserdbeere'));
      const response = await call(USER_A, 'PUT', `/plants/${plant.id}`, {
        ...fields('Monatserdbeere'),
        spacingInRowCm: 25,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: plant.id,
        spacingInRowCm: 25,
        publication: { status: 'PRIVATE' },
      });
    });

    it('does not let another user change an own plant', async () => {
      const plant = await create(USER_A, fields('Meine Sorte'));
      const response = await call(USER_B, 'PUT', `/plants/${plant.id}`, fields('Übernommen'));
      expect(response.status).toBe(404);
      expect((await list(USER_A)).find((p) => p.id === plant.id)?.name).toBe('Meine Sorte');
    });

    it('archives a used own plant instead of deleting it', async () => {
      const plant = await create(USER_A, fields('Alte Sorte'));
      // A planting in the garden service may reference the plant; the item must survive.
      const response = await call(USER_A, 'DELETE', `/plants/${plant.id}`);
      expect(response.status).toBe(204);

      const { Item } = await db.client.send(
        new GetCommand({
          TableName: db.tableName,
          Key: { PK: userPk(USER_A), SK: plantSk(plant.id) },
        }),
      );
      expect(Item).toMatchObject({
        id: plant.id,
        name: 'Alte Sorte',
        archived: true,
        archivedAt: '2026-10-07T10:00:00.000Z',
      });
      expect((await list(USER_A)).some((p) => p.id === plant.id)).toBe(false);
      expect((await call(USER_A, 'PUT', `/plants/${plant.id}`, fields('X'))).status).toBe(404);
      expect((await call(USER_A, 'DELETE', `/plants/${plant.id}`)).status).toBe(204);
    });

    it('does not let another user archive an own plant', async () => {
      const plant = await create(USER_A, fields('Behalten'));
      expect((await call(USER_B, 'DELETE', `/plants/${plant.id}`)).status).toBe(404);
      expect((await list(USER_A)).some((p) => p.id === plant.id)).toBe(true);
    });

    it('does not archive global plants', async () => {
      expect((await call(USER_A, 'DELETE', `/plants/${tomato.id}`)).status).toBe(404);
    });
  });

  describe('overrides', () => {
    it('keeps overrides of one user invisible to other users', async () => {
      const response = await call(USER_A, 'PUT', `/plants/${basil.id}/override`, {
        spacingInRowCm: 20,
        color: '#123456',
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: basil.id,
        spacingInRowCm: 20,
        color: '#123456',
        source: 'GLOBAL',
        overridden: true,
      });

      expect((await list(USER_A)).find((p) => p.id === basil.id)).toMatchObject({
        spacingInRowCm: 20,
        overridden: true,
      });
      expect((await list(USER_B)).find((p) => p.id === basil.id)).toEqual({
        ...basil,
        source: 'GLOBAL',
        overridden: false,
      });
    });

    it('resets an override to the global plant', async () => {
      await call(USER_A, 'PUT', `/plants/${tomato.id}/override`, { rowSpacingCm: 70 });
      const response = await call(USER_A, 'DELETE', `/plants/${tomato.id}/override`);
      expect(response.status).toBe(204);
      expect((await list(USER_A)).find((p) => p.id === tomato.id)).toMatchObject({
        rowSpacingCm: tomato.rowSpacingCm,
        overridden: false,
      });
    });

    it('lets overrides of global plants only name global plants', async () => {
      const own = await create(USER_A, fields('Eigene Nachbarin'));
      const response = await call(USER_A, 'PUT', `/plants/${tomato.id}/override`, {
        goodNeighbors: [basil.id, own.id],
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: 'Bitte prüfe die Nachbarn.',
        issues: [
          {
            path: 'goodNeighbors.1',
            message: 'Globale Sorten dürfen nur auf globale Sorten verweisen.',
          },
        ],
      });
    });

    it('rejects empty overrides and unknown or own plants', async () => {
      expect((await call(USER_A, 'PUT', `/plants/${tomato.id}/override`, {})).status).toBe(400);
      const own = await create(USER_A, fields('Keine globale'));
      expect(
        (await call(USER_A, 'PUT', `/plants/${own.id}/override`, { spacingInRowCm: 10 })).status,
      ).toBe(404);
      expect((await call(USER_A, 'DELETE', `/plants/${own.id}/override`)).status).toBe(404);
    });
  });
});

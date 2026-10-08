import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type {
  Bed,
  CatalogPlant,
  ListPlantsResponse,
  Plant,
  PlantFields,
  Planting,
  PublicationQueueResponse,
} from '@hochbeet/contracts';
import { evaluateBed } from '@hochbeet/garden-rules';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createLogger } from '../logger';
import { writeSeed } from '../seed/handler';
import { seedItems } from '../seed/items';
import { GLOBAL_PK, plantSk } from '../table';
import { startCatalogTable } from '../test/dynamodb-local';
import { authorized, seedPlant, USER_A, USER_B } from '../test/fixtures';
import { CatalogRepository } from './repository';

const ADMIN = 'a1b2c3d4-0000-4000-8000-0000000000ad';

// Publication workflow and admin endpoints against DynamoDB Local.
describe('publication and admin endpoints against DynamoDB Local', () => {
  let db: Awaited<ReturnType<typeof startCatalogTable>>;
  let app: ReturnType<typeof createApp>;
  const tomato = seedPlant('Tomate');

  const fields = (name: string, extra: Partial<PlantFields> = {}): PlantFields => {
    const { id: _id, ...rest } = seedPlant('Erdbeere');
    return { ...rest, name, goodNeighbors: [], badNeighbors: [], ...extra };
  };

  const call = (userId: string, method: string, path: string, body?: unknown, groups?: string) =>
    app.request(
      `/api/catalog${path}`,
      body === undefined
        ? { method }
        : { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
      authorized(userId, groups),
    );
  const asAdmin = (method: string, path: string, body?: unknown) =>
    call(ADMIN, method, path, body, '[admins]');

  const list = async (userId: string) =>
    ((await (await call(userId, 'GET', '/plants')).json()) as ListPlantsResponse).plants;
  const queue = async () =>
    ((await (await asAdmin('GET', '/admin/publications')).json()) as PublicationQueueResponse)
      .requests;

  const createAndRequest = async (userId: string, body: PlantFields) => {
    const created = (await (await call(userId, 'POST', '/plants', body)).json()) as CatalogPlant;
    const response = await call(userId, 'POST', `/plants/${created.id}/publication`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ publication: { status: 'PENDING' } });
    return created;
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

  it('answers 403 to non-admins on the admin routes', async () => {
    expect((await call(USER_A, 'GET', '/admin/publications')).status).toBe(403);
    expect((await call(USER_A, 'POST', '/admin/plants', fields('Hack'))).status).toBe(403);
    expect((await call(USER_A, 'POST', '/admin/publications/X/approve', {})).status).toBe(403);
  });

  it('keeps the id on approval, so existing plantings keep working', async () => {
    const melisse = await createAndRequest(
      USER_A,
      fields('Zitronenmelisse', { goodNeighbors: [tomato.id] }),
    );

    // User A already planted it next to a tomato.
    const bed: Bed = {
      id: '01J9ZQ3W8D6V2K5M7N8P9R0S1T',
      name: 'Beet',
      widthCm: 200,
      depthCm: 100,
      mainRowDirection: 'H',
      soilRenewals: [],
    };
    const planting = (id: string, plantId: string, x: number): Planting => ({
      id,
      bedId: bed.id,
      plantId,
      kind: 'SINGLE',
      x,
      y: 50,
      startDate: '2026-05-04',
      endDate: '2026-09-28',
      removedDate: null,
    });
    const plantings = [
      planting('01J9ZQ3W8D6V2K5M7N8P9R0S2A', melisse.id, 40),
      planting('01J9ZQ3W8D6V2K5M7N8P9R0S2B', tomato.id, 100),
    ];
    const findings = (plants: readonly Plant[]) =>
      evaluateBed(bed, plantings, plants).map((f) => [f.rule, f.plantingIds]);
    const before = findings(await list(USER_A));
    expect(before).toContainEqual(['GOOD_NEIGHBOR', plantings.map((p) => p.id)]);

    expect(await queue()).toEqual([
      {
        plant: expect.objectContaining({ id: melisse.id, name: 'Zitronenmelisse' }) as unknown,
        requestedBy: USER_A,
        requestedAt: '2026-10-07',
      },
    ]);

    const approved = await asAdmin('POST', `/admin/publications/${melisse.id}/approve`, {
      corrections: { spacingInRowCm: 35 },
    });
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ id: melisse.id, spacingInRowCm: 35 });

    // Global for everyone, with the same id; the author sees it once, as a global plant.
    const forB = (await list(USER_B)).filter((p) => p.id === melisse.id);
    expect(forB).toEqual([expect.objectContaining({ source: 'GLOBAL', spacingInRowCm: 35 })]);
    const forA = (await list(USER_A)).filter((p) => p.id === melisse.id);
    expect(forA).toEqual([expect.objectContaining({ source: 'GLOBAL', overridden: false })]);
    expect(await queue()).toEqual([]);

    // The planting still resolves its plant and gets the same findings.
    expect(findings(await list(USER_A))).toEqual(before);
    expect(findings(await list(USER_B))).toEqual(before);
  });

  it("turns the author's later changes of a published plant into an override", async () => {
    const plant = await createAndRequest(USER_A, fields('Bergbohnenkraut'));
    await asAdmin('POST', `/admin/publications/${plant.id}/approve`, {});
    const response = await call(USER_A, 'PUT', `/plants/${plant.id}`, {
      ...fields('Bergbohnenkraut'),
      rowSpacingCm: 55,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: plant.id,
      rowSpacingCm: 55,
      source: 'GLOBAL',
      overridden: true,
    });
    expect((await list(USER_B)).find((p) => p.id === plant.id)?.rowSpacingCm).not.toBe(55);
    expect((await call(USER_A, 'POST', `/plants/${plant.id}/publication`)).status).toBe(409);
  });

  it('sends a rejected plant back to PRIVATE with the comment', async () => {
    const plant = await createAndRequest(USER_A, fields('Andenbeere'));
    const rejected = await asAdmin('POST', `/admin/publications/${plant.id}/reject`, {
      comment: 'Bitte Abstände prüfen.',
    });
    expect(rejected.status).toBe(204);
    expect((await list(USER_A)).find((p) => p.id === plant.id)).toMatchObject({
      source: 'OWN',
      publication: { status: 'PRIVATE', rejectionComment: 'Bitte Abstände prüfen.' },
    });
    expect(await queue()).toEqual([]);
    expect((await list(USER_B)).some((p) => p.id === plant.id)).toBe(false);
    expect((await asAdmin('POST', `/admin/publications/${plant.id}/approve`, {})).status).toBe(404);

    // Asking again clears the old comment.
    const again = (await (
      await call(USER_A, 'POST', `/plants/${plant.id}/publication`)
    ).json()) as CatalogPlant;
    expect(again.publication).toEqual({ status: 'PENDING' });
    await asAdmin('POST', `/admin/publications/${plant.id}/reject`, { comment: 'Nein.' });
  });

  it('only publishes plants whose neighbours are global', async () => {
    const own = (await (
      await call(USER_A, 'POST', '/plants', fields('Nachbarin'))
    ).json()) as Plant;
    const plant = (await (
      await call(
        USER_A,
        'POST',
        '/plants',
        fields('Mit eigener Nachbarin', { badNeighbors: [own.id] }),
      )
    ).json()) as Plant;
    const response = await call(USER_A, 'POST', `/plants/${plant.id}/publication`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'Bitte prüfe die Nachbarn.',
      issues: [
        {
          path: 'badNeighbors.0',
          message: 'Globale Sorten dürfen nur auf globale Sorten verweisen.',
        },
      ],
    });
  });

  it('takes archived plants out of the queue', async () => {
    const plant = await createAndRequest(USER_B, fields('Verworfen'));
    expect((await call(USER_B, 'DELETE', `/plants/${plant.id}`)).status).toBe(204);
    expect(await queue()).toEqual([]);
  });

  it('lets admins create and change global plants', async () => {
    const created = await asAdmin(
      'POST',
      '/admin/plants',
      fields('Pak Choi', { goodNeighbors: [tomato.id] }),
    );
    expect(created.status).toBe(201);
    const pakChoi = (await created.json()) as Plant;
    expect((await list(USER_B)).find((p) => p.id === pakChoi.id)).toMatchObject({
      source: 'GLOBAL',
    });

    const { id: _id, ...tomatoFields } = tomato;
    const changed = await asAdmin('PUT', `/admin/plants/${tomato.id}`, {
      ...tomatoFields,
      spacingInRowCm: 55,
    });
    expect(changed.status).toBe(200);
    expect((await list(USER_A)).find((p) => p.id === tomato.id)?.spacingInRowCm).toBe(55);

    // The seed hash stays, so a later change of the tomato in the seed still applies.
    const { Item } = await db.client.send(
      new GetCommand({ TableName: db.tableName, Key: { PK: GLOBAL_PK, SK: plantSk(tomato.id) } }),
    );
    expect(Item?.seedHash).toBe(seedItems().find((i) => i.id === tomato.id)?.seedHash);

    expect(
      (await asAdmin('PUT', '/admin/plants/01J9ZQ3W8D6V2K5M7N8P9R0SZZ', fields('X'))).status,
    ).toBe(404);
  });
});

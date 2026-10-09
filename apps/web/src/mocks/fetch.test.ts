import type {
  Bed,
  BedWithPlantingsResponse,
  ListBedsResponse,
  ListPlantsResponse,
} from '@hochbeet/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockFetch } from './fetch';
import { MockStore } from './store';

const auth = (email: string) => ({ Authorization: `Bearer mock-id-token.${email}` });
const json = { 'Content-Type': 'application/json' };
const bedFields = (name: string) => ({
  name,
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'V',
  soilRenewals: [],
});

describe('mock API', () => {
  let fetchFn: typeof fetch;
  const createBed = async (email: string, name: string) => {
    const response = await fetchFn('/api/garden/beds', {
      method: 'POST',
      headers: { ...auth(email), ...json },
      body: JSON.stringify(bedFields(name)),
    });
    expect(response.status).toBe(201);
    return (await response.json()) as Bed;
  };
  const listBeds = async (email: string) =>
    (
      (await (
        await fetchFn('/api/garden/beds', { headers: auth(email) })
      ).json()) as ListBedsResponse
    ).beds;

  const plantsOf = async (email: string) =>
    (
      (await (
        await fetchFn('/api/catalog/plants', { headers: auth(email) })
      ).json()) as ListPlantsResponse
    ).plants;

  beforeEach(() => {
    localStorage.clear();
    fetchFn = createMockFetch(new MockStore(localStorage));
  });

  it('answers 401 without token, like the services', async () => {
    const response = await fetchFn('/api/garden/beds');
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Bitte melde dich an.' });
  });

  it('serves the global catalogue without token, like the public catalog route', async () => {
    const response = await fetchFn('/api/catalog/public/plants');
    expect(response.status).toBe(200);
    const { plants } = (await response.json()) as { plants: Record<string, unknown>[] };
    expect(plants).toHaveLength(56);
    expect(plants[0]).not.toHaveProperty('source');
    expect((await fetchFn('/api/catalog/public/plants', { method: 'POST' })).status).toBe(404);
  });

  it('keeps beds per user, sorted by name', async () => {
    await createBed('a@example.com', 'Zweites');
    await createBed('a@example.com', 'Erstes');
    expect((await listBeds('a@example.com')).map((b) => b.name)).toEqual(['Erstes', 'Zweites']);
    expect(await listBeds('b@example.com')).toEqual([]);
  });

  it('validates with the contract schemas and German messages', async () => {
    const response = await fetchFn('/api/garden/beds', {
      method: 'POST',
      headers: { ...auth('a@example.com'), ...json },
      body: JSON.stringify({ ...bedFields('X'), widthCm: 203 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'Bitte prüfe deine Eingaben.',
      issues: [{ path: 'widthCm', message: 'Muss ein Vielfaches von 5 cm sein.' }],
    });
  });

  it('renames a bed and deletes it with its plantings', async () => {
    const bed = await createBed('a@example.com', 'Alt');
    await fetchFn(`/api/garden/beds/${bed.id}/plantings`, {
      method: 'POST',
      headers: { ...auth('a@example.com'), ...json },
      body: JSON.stringify({
        kind: 'SINGLE',
        plantId: '01M49THV00SZ6Q8R32BYJM5P2S',
        x: 20,
        y: 20,
        startDate: '2026-05-04',
        endDate: null,
        removedDate: null,
      }),
    });
    const renamed = await fetchFn(`/api/garden/beds/${bed.id}`, {
      method: 'PUT',
      headers: { ...auth('a@example.com'), ...json },
      body: JSON.stringify(bedFields('Neu')),
    });
    expect(await renamed.json()).toMatchObject({ id: bed.id, name: 'Neu' });
    const details = (await (
      await fetchFn(`/api/garden/beds/${bed.id}`, { headers: auth('a@example.com') })
    ).json()) as BedWithPlantingsResponse;
    expect(details.plantings).toHaveLength(1);

    const deleted = await fetchFn(`/api/garden/beds/${bed.id}`, {
      method: 'DELETE',
      headers: auth('a@example.com'),
    });
    expect(deleted.status).toBe(204);
    expect(await listBeds('a@example.com')).toEqual([]);
    expect(new MockStore(localStorage).read('a@example.com').plantings).toEqual([]);
  });

  it('serves the start catalogue', async () => {
    const response = await fetchFn('/api/catalog/plants', { headers: auth('a@example.com') });
    const { plants } = (await response.json()) as { plants: unknown[] };
    expect(plants).toHaveLength(56);
  });

  it('applies and resets personal adjustments per user', async () => {
    const lettuce = '01M49THV00RK9E9PC83NEE87CJ'; // Kopfsalat, 25 cm

    const saved = await fetchFn(`/api/catalog/plants/${lettuce}/override`, {
      method: 'PUT',
      headers: { ...auth('a@example.com'), ...json },
      body: JSON.stringify({ spacingInRowCm: 40 }),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({
      spacingInRowCm: 40,
      overridden: true,
      global: { spacingInRowCm: 25 },
    });
    expect((await plantsOf('a@example.com')).find((p) => p.id === lettuce)).toMatchObject({
      spacingInRowCm: 40,
      overridden: true,
    });
    expect((await plantsOf('b@example.com')).find((p) => p.id === lettuce)).toMatchObject({
      spacingInRowCm: 25,
      overridden: false,
    });

    const reset = await fetchFn(`/api/catalog/plants/${lettuce}/override`, {
      method: 'DELETE',
      headers: auth('a@example.com'),
    });
    expect(reset.status).toBe(204);
    const plant = (await plantsOf('a@example.com')).find((p) => p.id === lettuce);
    expect(plant).toMatchObject({ spacingInRowCm: 25, overridden: false });
    expect(plant?.global).toBeUndefined();
  });

  it('creates own plants, checks neighbours and asks for publication', async () => {
    const email = 'a@example.com';
    const onion = '01M49THV006G34Z07ZJ8N4X0KS';
    const fields = {
      name: 'Haferwurzel',
      category: 'GEMUESE',
      family: 'Korbblütler',
      feeder: 'SCHWACH',
      spacingInRowCm: 10,
      rowSpacingCm: 25,
      lifecycle: { type: 'ANNUAL', cultureWeeks: 20 },
      goodNeighbors: [] as string[],
      badNeighbors: [] as string[],
      color: '#c9a66b',
      icon: 'category-gemuese',
    };
    const send = (path: string, method: string, body?: unknown) =>
      fetchFn(path, {
        method,
        headers: { ...auth(email), ...json },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    const unknown = await send('/api/catalog/plants', 'POST', {
      ...fields,
      goodNeighbors: ['01J9ZQ3W8D6V2K5M7N8P9R0XXX'],
    });
    expect(unknown.status).toBe(400);

    const created = (await (await send('/api/catalog/plants', 'POST', fields)).json()) as {
      id: string;
    };
    const own = await send('/api/catalog/plants', 'POST', {
      ...fields,
      name: 'Zweite',
      goodNeighbors: [created.id],
    });
    expect(own.status).toBe(201);
    const second = (await own.json()) as { id: string };
    // Publication needs global neighbours only.
    expect((await send(`/api/catalog/plants/${second.id}/publication`, 'POST')).status).toBe(400);

    await send(`/api/catalog/plants/${created.id}`, 'PUT', { ...fields, goodNeighbors: [onion] });
    const requested = await send(`/api/catalog/plants/${created.id}/publication`, 'POST');
    expect(await requested.json()).toMatchObject({
      source: 'OWN',
      goodNeighbors: [onion],
      publication: { status: 'PENDING' },
    });

    await send(`/api/catalog/plants/${second.id}`, 'DELETE');
    const names = (await plantsOf(email)).filter((p) => p.source === 'OWN').map((p) => p.name);
    expect(names).toEqual(['Haferwurzel']);
    expect(await plantsOf('b@example.com')).toHaveLength(56);
  });

  it('lets admins approve, reject and maintain global plants', async () => {
    const admin = { Authorization: 'Bearer mock-id-token.admin@example.com|admins' };
    const call = (path: string, method: string, headers: Record<string, string>, body?: unknown) =>
      fetchFn(path, {
        method,
        headers: { ...headers, ...json },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const fields = {
      name: 'Haferwurzel',
      category: 'GEMUESE',
      family: 'Korbblütler',
      feeder: 'SCHWACH',
      spacingInRowCm: 10,
      rowSpacingCm: 25,
      lifecycle: { type: 'ANNUAL', cultureWeeks: 20 },
      goodNeighbors: [],
      badNeighbors: [],
      color: '#c9a66b',
      icon: 'category-gemuese',
    };
    const create = async (name: string) => {
      const response = await call('/api/catalog/plants', 'POST', auth('a@example.com'), {
        ...fields,
        name,
      });
      const { id } = (await response.json()) as { id: string };
      await call(`/api/catalog/plants/${id}/publication`, 'POST', auth('a@example.com'));
      return id;
    };
    const approved = await create('Haferwurzel');
    const rejected = await create('Zuckerhut');

    // Not for normal users.
    const forbidden = await call('/api/catalog/admin/publications', 'GET', auth('a@example.com'));
    expect(forbidden.status).toBe(403);

    const queue = (await (await call('/api/catalog/admin/publications', 'GET', admin)).json()) as {
      requests: { plant: { id: string }; requestedBy: string }[];
    };
    expect(queue.requests.map((r) => [r.plant.id, r.requestedBy])).toEqual([
      [approved, 'a@example.com'],
      [rejected, 'a@example.com'],
    ]);

    await call(`/api/catalog/admin/publications/${approved}/approve`, 'POST', admin, {
      corrections: { rowSpacingCm: 30 },
    });
    await call(`/api/catalog/admin/publications/${rejected}/reject`, 'POST', admin, {
      comment: 'Gibt es schon als Endivie.',
    });

    // The approved plant is global now, with the same id, for everyone.
    const other = (await plantsOf('b@example.com')).find((p) => p.id === approved);
    expect(other).toMatchObject({ source: 'GLOBAL', rowSpacingCm: 30 });
    const own = (await plantsOf('a@example.com')).filter((p) => p.source === 'OWN');
    expect(own).toEqual([
      expect.objectContaining({
        id: rejected,
        publication: { status: 'PRIVATE', rejectionComment: 'Gibt es schon als Endivie.' },
      }),
    ]);

    const global = await call('/api/catalog/admin/plants', 'POST', admin, {
      ...fields,
      name: 'Yacón',
    });
    expect(global.status).toBe(201);
    const { id } = (await global.json()) as { id: string };
    await call(`/api/catalog/admin/plants/${id}`, 'PUT', admin, { ...fields, name: 'Yacon' });
    expect((await plantsOf('b@example.com')).find((p) => p.id === id)?.name).toBe('Yacon');
  });
});

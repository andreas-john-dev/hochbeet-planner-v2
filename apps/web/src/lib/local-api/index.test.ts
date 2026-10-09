import { seedPlants } from '@hochbeet/catalog-seed';
import type {
  Bed,
  BedWithPlantingsResponse,
  CatalogPlant,
  ListPlantsResponse,
} from '@hochbeet/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalFetch, publicCatalog } from './index';
import { createGuestRepository, GUEST_STORAGE_KEY } from './store';

const bedFields = (name: string) => ({
  name,
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'V',
  soilRenewals: [],
});
const plantingFields = {
  kind: 'SINGLE',
  plantId: '01M49THV00SZ6Q8R32BYJM5P2S',
  x: 20,
  y: 20,
  startDate: '2026-05-04',
  endDate: null,
  removedDate: null,
};
const ownFields = {
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
const lettuce = '01M49THV00RK9E9PC83NEE87CJ'; // Kopfsalat, 25 cm
const UNKNOWN = '01J9ZQ3W8D6V2K5M7N8P9R0XXX';

describe('createLocalFetch', () => {
  let fetchFn: typeof fetch;
  const send = (path: string, method = 'GET', body?: unknown) =>
    fetchFn(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const plants = async () =>
    ((await (await send('/api/catalog/plants')).json()) as ListPlantsResponse).plants;

  beforeEach(() => {
    localStorage.clear();
    fetchFn = createLocalFetch({
      repo: createGuestRepository(localStorage),
      globals: () => seedPlants,
    });
  });

  it('keeps beds and plantings in localStorage, without a token', async () => {
    expect((await send('/api/garden/beds', 'POST', bedFields('Zweites'))).status).toBe(201);
    const bed = (await (await send('/api/garden/beds', 'POST', bedFields('Erstes'))).json()) as Bed;
    const listed = (await (await send('/api/garden/beds')).json()) as { beds: Bed[] };
    expect(listed.beds.map((b) => b.name)).toEqual(['Erstes', 'Zweites']);

    const created = await send(`/api/garden/beds/${bed.id}/plantings`, 'POST', plantingFields);
    expect(created.status).toBe(201);
    const planting = (await created.json()) as { id: string };
    const moved = await send(`/api/garden/beds/${bed.id}/plantings/${planting.id}`, 'PUT', {
      ...plantingFields,
      x: 40,
    });
    expect(await moved.json()).toMatchObject({ id: planting.id, bedId: bed.id, x: 40 });

    // A new fetch on the same storage sees everything: the data survives reloads.
    fetchFn = createLocalFetch({ globals: () => seedPlants });
    const details = (await (
      await send(`/api/garden/beds/${bed.id}`)
    ).json()) as BedWithPlantingsResponse;
    expect(details.plantings).toMatchObject([{ id: planting.id, x: 40 }]);

    const renamed = await send(`/api/garden/beds/${bed.id}`, 'PUT', {
      ...bedFields('Neu'),
      soilRenewals: ['2027-03-01'],
    });
    expect(await renamed.json()).toMatchObject({ name: 'Neu', soilRenewals: ['2027-03-01'] });

    expect(
      (await send(`/api/garden/beds/${bed.id}/plantings/${planting.id}`, 'DELETE')).status,
    ).toBe(204);
    expect((await send(`/api/garden/beds/${bed.id}`, 'DELETE')).status).toBe(204);
    expect(createGuestRepository(localStorage).read()).toMatchObject({
      beds: [expect.objectContaining({ name: 'Zweites' }) as unknown],
      plantings: [],
    });
  });

  it('answers 400 with German issues for invalid requests', async () => {
    const response = await send('/api/garden/beds', 'POST', { ...bedFields('X'), widthCm: 203 });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'Bitte prüfe deine Eingaben.',
      issues: [{ path: 'widthCm', message: 'Muss ein Vielfaches von 5 cm sein.' }],
    });
  });

  it('answers 404 for unknown ids', async () => {
    const bed = (await (await send('/api/garden/beds', 'POST', bedFields('A'))).json()) as Bed;
    const cases: [string, string, unknown?][] = [
      [`/api/garden/beds/${UNKNOWN}`, 'GET'],
      [`/api/garden/beds/${UNKNOWN}`, 'PUT', bedFields('B')],
      [`/api/garden/beds/${UNKNOWN}`, 'DELETE'],
      [`/api/garden/beds/${UNKNOWN}/plantings`, 'POST', plantingFields],
      [`/api/garden/beds/${bed.id}/plantings/${UNKNOWN}`, 'PUT', plantingFields],
      [`/api/garden/beds/${bed.id}/plantings/${UNKNOWN}`, 'DELETE'],
      [`/api/catalog/plants/${UNKNOWN}`, 'PUT', ownFields],
      [`/api/catalog/plants/${UNKNOWN}`, 'DELETE'],
      [`/api/catalog/plants/${UNKNOWN}/override`, 'PUT', { spacingInRowCm: 30 }],
      [`/api/catalog/plants/${UNKNOWN}/override`, 'DELETE'],
    ];
    for (const [path, method, body] of cases) {
      const response = await send(path, method, body);
      expect(response.status, `${method} ${path}`).toBe(404);
      expect(((await response.json()) as { message: string }).message).toMatch(/gibt es nicht/);
    }
  });

  it('serves the global catalogue with personal adjustments', async () => {
    expect(await plants()).toHaveLength(56);
    const saved = await send(`/api/catalog/plants/${lettuce}/override`, 'PUT', {
      spacingInRowCm: 40,
    });
    expect(await saved.json()).toMatchObject({
      spacingInRowCm: 40,
      overridden: true,
      global: { spacingInRowCm: 25 },
    });
    expect((await plants()).find((p) => p.id === lettuce)).toMatchObject({ spacingInRowCm: 40 });

    expect((await send(`/api/catalog/plants/${lettuce}/override`, 'DELETE')).status).toBe(204);
    expect((await plants()).find((p) => p.id === lettuce)).toMatchObject({
      spacingInRowCm: 25,
      overridden: false,
    });
  });

  it('keeps own plants, checks neighbours and refuses publication for guests', async () => {
    const unknown = await send('/api/catalog/plants', 'POST', {
      ...ownFields,
      goodNeighbors: [UNKNOWN],
    });
    expect(unknown.status).toBe(400);

    const created = (await (
      await send('/api/catalog/plants', 'POST', ownFields)
    ).json()) as CatalogPlant;
    expect(created).toMatchObject({ source: 'OWN', publication: { status: 'PRIVATE' } });
    const self = await send(`/api/catalog/plants/${created.id}`, 'PUT', {
      ...ownFields,
      goodNeighbors: [created.id],
    });
    expect(self.status).toBe(400);
    const updated = await send(`/api/catalog/plants/${created.id}`, 'PUT', {
      ...ownFields,
      goodNeighbors: [lettuce],
    });
    expect(await updated.json()).toMatchObject({ goodNeighbors: [lettuce] });
    expect((await plants()).filter((p) => p.source === 'OWN')).toHaveLength(1);

    const publication = await send(`/api/catalog/plants/${created.id}/publication`, 'POST');
    expect(publication.status).toBe(403);

    expect((await send(`/api/catalog/plants/${created.id}`, 'DELETE')).status).toBe(204);
    expect((await plants()).filter((p) => p.source === 'OWN')).toEqual([]);
  });

  it('answers 507 when the browser storage is full', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const response = await send('/api/garden/beds', 'POST', bedFields('A'));
    setItem.mockRestore();
    expect(response.status).toBe(507);
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
  });
});

describe('publicCatalog', () => {
  const ok = () => Response.json({ plants: seedPlants });

  it('loads the public catalogue once and shares it', async () => {
    const baseFetch = vi.fn<typeof fetch>(() => Promise.resolve(ok()));
    const globals = publicCatalog(baseFetch);
    expect(await globals()).toHaveLength(56);
    await globals();
    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch).toHaveBeenCalledWith('/api/catalog/public/plants');
  });

  it('answers 503 with a German message when the catalogue is unreachable, and tries again later', async () => {
    const baseFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(Response.json({ nope: true }))
      .mockResolvedValue(ok());
    const fetchFn = createLocalFetch({
      repo: createGuestRepository(localStorage),
      globals: publicCatalog(baseFetch),
    });
    const send = (path: string) => fetchFn(path);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await send('/api/catalog/plants');
      expect(response.status).toBe(503);
      expect(((await response.json()) as { message: string }).message).toMatch(/Katalog/);
    }
    expect((await send('/api/catalog/plants')).status).toBe(200);
  });
});

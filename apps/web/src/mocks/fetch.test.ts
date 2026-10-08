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

  beforeEach(() => {
    localStorage.clear();
    fetchFn = createMockFetch(new MockStore(localStorage));
  });

  it('answers 401 without token, like the services', async () => {
    const response = await fetchFn('/api/garden/beds');
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Bitte melde dich an.' });
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
    const plantsOf = async (email: string) =>
      (
        (await (
          await fetchFn('/api/catalog/plants', { headers: auth(email) })
        ).json()) as ListPlantsResponse
      ).plants;

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
});

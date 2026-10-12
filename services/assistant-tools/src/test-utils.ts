import type { Bed, CatalogPlant, Planting } from '@hochbeet/contracts';
import { seedPlantByName, seedPlants } from '@hochbeet/catalog-seed';

const base64url = (value: string) => Buffer.from(value).toString('base64url');

/** An unsigned JWT with `sub`; the fake API reads it like the services' authorizers. */
export const tokenFor = (sub: string) =>
  `${base64url('{"alg":"none"}')}.${base64url(JSON.stringify({ sub, token_use: 'id' }))}.sig`;

const subOf = (authorization: string | null) => {
  const payload = authorization?.replace(/^Bearer /, '').split('.')[1];
  if (!payload) return undefined;
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: string };
  return claims.sub;
};

export const catalog: CatalogPlant[] = seedPlants.map((plant) => ({
  ...plant,
  source: 'GLOBAL',
  overridden: false,
}));

export const plantId = (name: string) => {
  const plant = seedPlantByName.get(name);
  if (!plant) throw new Error(`no seed plant ${name}`);
  return plant.id;
};

export function bed(id: string, name: string): Bed {
  return { id, name, widthCm: 120, depthCm: 80, mainRowDirection: 'H', soilRenewals: [] };
}

export function planting(
  id: string,
  bedId: string,
  plant: string,
  at: { x: number; y: number },
): Planting {
  return {
    id,
    bedId,
    kind: 'SINGLE',
    plantId: plantId(plant),
    ...at,
    startDate: '2026-05-04',
    endDate: '2026-08-31',
    removedDate: null,
  };
}

export interface FakeGarden {
  beds: Bed[];
  plantings: Planting[];
}

/**
 * The read endpoints of garden and catalog service as `fetch`: every user only reaches their
 * own beds, another user's bed is a 404, exactly like the services (userId from `sub`).
 */
export function fakeApi(gardens: Record<string, FakeGarden>) {
  const calls: { path: string; sub: string | undefined }[] = [];
  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const fetchFn: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const sub = subOf(new Headers(init?.headers).get('Authorization'));
    calls.push({ path: url.pathname, sub });
    const garden = sub ? gardens[sub] : undefined;
    if (!garden) return Promise.resolve(json({ message: 'Bitte melde dich an.' }, 401));
    if (url.pathname === '/api/garden/beds') return Promise.resolve(json({ beds: garden.beds }));
    if (url.pathname === '/api/catalog/plants') return Promise.resolve(json({ plants: catalog }));
    const bedId = /^\/api\/garden\/beds\/([^/]+)$/.exec(url.pathname)?.[1];
    const found = garden.beds.find((b) => b.id === bedId);
    if (!found) return Promise.resolve(json({ message: 'Beet nicht gefunden.' }, 404));
    return Promise.resolve(
      json({ bed: found, plantings: garden.plantings.filter((p) => p.bedId === found.id) }),
    );
  };
  return { fetch: fetchFn, calls };
}

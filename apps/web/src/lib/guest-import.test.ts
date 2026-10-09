import type { Bed, Planting } from '@hochbeet/contracts';
import { seedPlants } from '@hochbeet/catalog-seed';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiFetch } from './api';
import {
  catalogImportRequest,
  describeGuestData,
  gardenImportRequest,
  guestImportId,
  hasGuestData,
  importGuestData,
} from './guest-import';
import { GUEST_IMPORT_ID_KEY } from './local-api/keys';
import type { LocalGarden, OwnPlant } from './local-api/store';

const [global] = seedPlants;
if (!global) throw new Error('seed missing');
const OWN = '01J9ZQ3W8D6V2K5M7N8P9R0WNA';
const bed: Bed = {
  id: '01J9ZQ3W8D6V2K5M7N8P9R0BED',
  name: 'Balkon',
  widthCm: 100,
  depthCm: 50,
  mainRowDirection: 'V',
  soilRenewals: [],
};
const planting = (id: string, plantId: string): Planting => ({
  id,
  bedId: bed.id,
  kind: 'SINGLE',
  plantId,
  x: 20,
  y: 20,
  startDate: '2026-05-04',
  endDate: null,
  removedDate: null,
});
const own: OwnPlant = {
  ...global,
  id: OWN,
  name: 'Haferwurzel',
  source: 'OWN',
  overridden: false,
  publication: { status: 'PRIVATE' },
};
const garden: LocalGarden = {
  beds: [bed],
  plantings: [
    planting('01J9ZQ3W8D6V2K5M7N8P9R0PA1', OWN),
    planting('01J9ZQ3W8D6V2K5M7N8P9R0PA2', global.id),
  ],
  ownPlants: [own, { ...own, id: '01J9ZQ3W8D6V2K5M7N8P9R0WNB', archived: true }],
  overrides: { [global.id]: { spacingInRowCm: 30 } },
};

describe('guest data', () => {
  it('knows whether there is anything worth importing', () => {
    expect(hasGuestData({ beds: [], plantings: [] })).toBe(false);
    expect(hasGuestData({ beds: [], plantings: [], overrides: {} })).toBe(false);
    expect(hasGuestData(garden)).toBe(true);
  });

  it('describes it in German', () => {
    expect(describeGuestData(garden)).toBe('1 Beet, 2 Pflanzungen, 1 eigene Sorte und 1 Anpassung');
    expect(describeGuestData({ beds: [bed, bed], plantings: [] })).toBe('2 Beete');
  });
});

describe('import requests', () => {
  it('sends own plants with plant fields only, archived ones marked, and adjustments', () => {
    const request = catalogImportRequest(garden, 'IMPORT');
    expect(request.ownPlants[0]).not.toHaveProperty('source');
    expect(request.ownPlants.map((p) => p.archived)).toEqual([undefined, true]);
    expect(request.overrides).toEqual([{ plantId: global.id, fields: { spacingInRowCm: 30 } }]);
  });

  it('points plantings to the new ids of imported own plants', () => {
    const request = gardenImportRequest(garden, 'IMPORT', { [OWN]: 'NEW-OWN' });
    expect(request.plantings.map((p) => p.plantId)).toEqual(['NEW-OWN', global.id]);
  });
});

describe('importGuestData', () => {
  it('imports the catalogue first and maps the plantings with its answer', async () => {
    const api = vi.fn((path: string, _init?: RequestInit) =>
      Promise.resolve(path === '/api/catalog/import' ? { plantIds: { [OWN]: 'NEW-OWN' } } : {}),
    );
    await importGuestData(api as unknown as ApiFetch, garden, 'IMPORT');
    expect(api.mock.calls.map(([path]) => path)).toEqual([
      '/api/catalog/import',
      '/api/garden/import',
    ]);
    const body = JSON.parse(api.mock.calls[1]?.[1]?.body as string) as { plantings: Planting[] };
    expect(body.plantings[0]?.plantId).toBe('NEW-OWN');
  });

  it('skips a service that has nothing to import', async () => {
    const api = vi.fn((_path: string) => Promise.resolve({}));
    await importGuestData(api as unknown as ApiFetch, { beds: [bed], plantings: [] }, 'IMPORT');
    expect(api.mock.calls.map(([path]) => path)).toEqual(['/api/garden/import']);
  });
});

describe('guestImportId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stays the same until the import succeeded', () => {
    const id = guestImportId();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(guestImportId()).toBe(id);
    localStorage.removeItem(GUEST_IMPORT_ID_KEY);
    expect(guestImportId()).not.toBe(id);
  });
});

import type { Bed, Planting } from '@hochbeet/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createGuestRepository,
  GUEST_BACKUP_KEY,
  GUEST_STORAGE_KEY,
  type LocalGarden,
  loadGarden,
} from './store';

const bed: Bed = {
  id: '01J9ZQ3W8D6V2K5M7N8P9R0BED',
  name: 'Hochbeet',
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'V',
  soilRenewals: [],
};
const planting: Planting = {
  id: '01J9ZQ3W8D6V2K5M7N8P9R0PA1',
  bedId: bed.id,
  kind: 'SINGLE',
  plantId: '01M49THV00SZ6Q8R32BYJM5P2S',
  x: 20,
  y: 20,
  startDate: '2026-05-04',
  endDate: null,
  removedDate: null,
};
const envelope = (garden: unknown, version = 1) => JSON.stringify({ version, garden });

describe('loadGarden', () => {
  it('starts empty without stored data', () => {
    expect(loadGarden(null)).toEqual({ beds: [], plantings: [] });
  });

  it('keeps valid data', () => {
    expect(loadGarden(envelope({ beds: [bed], plantings: [planting] }))).toMatchObject({
      beds: [bed],
      plantings: [planting],
    });
  });

  it('drops invalid entries one by one and plantings of missing beds', () => {
    const garden = loadGarden(
      envelope({
        beds: [bed, { ...bed, id: 'kaputt' }],
        plantings: [
          planting,
          { ...planting, id: '01J9ZQ3W8D6V2K5M7N8P9R0PA2', x: 3 },
          { ...planting, id: '01J9ZQ3W8D6V2K5M7N8P9R0PA3', bedId: '01J9ZQ3W8D6V2K5M7N8P9R0XXX' },
        ],
        overrides: { a: { spacingInRowCm: 30 }, b: { nope: true } },
        ownPlants: [{ name: 'ohne Rest' }],
      }),
    );
    expect(garden).toEqual({
      beds: [bed],
      plantings: [planting],
      overrides: { a: { spacingInRowCm: 30 } },
      ownPlants: [],
    });
  });

  it('cannot read broken JSON, other shapes and newer versions', () => {
    expect(loadGarden('{kaputt')).toBeUndefined();
    expect(loadGarden(JSON.stringify({ beds: [] }))).toBeUndefined();
    expect(loadGarden(envelope({ beds: [] }, 2))).toBeUndefined();
  });
});

describe('createGuestRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes the garden in a versioned envelope and reads it back', () => {
    const repo = createGuestRepository(localStorage);
    const garden: LocalGarden = { beds: [bed], plantings: [planting] };
    repo.write(garden);
    expect(JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) ?? '')).toEqual({
      version: 1,
      garden,
    });
    expect(repo.read()).toMatchObject(garden);
  });

  it('moves unreadable data to a backup and starts empty', () => {
    localStorage.setItem(GUEST_STORAGE_KEY, '{kaputt');
    expect(createGuestRepository(localStorage).read()).toEqual({ beds: [], plantings: [] });
    expect(localStorage.getItem(GUEST_BACKUP_KEY)).toBe('{kaputt');
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
  });
});

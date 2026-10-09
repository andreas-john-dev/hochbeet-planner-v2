import type { ImportCatalogRequest } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { ownPlant, seedPlant } from '../test/fixtures';
import { planCatalogImport } from './import';

const tomato = seedPlant('Tomate');
const basil = seedPlant('Basilikum');
const GUEST_A = '01J9ZQ3W8D6V2K5M7N8P9R0WNA';
const GUEST_B = '01J9ZQ3W8D6V2K5M7N8P9R0WNB';
const UNKNOWN = '01J9ZQ3W8D6V2K5M7N8P9R0XXX';
const counter = () => {
  let n = 0;
  return () => `NEW${String(++n).padStart(23, '0')}`;
};

const request: ImportCatalogRequest = {
  importId: '01J9ZQ3W8D6V2K5M7N8P9R0MP1',
  ownPlants: [
    { ...ownPlant(GUEST_A, 'Haferwurzel'), goodNeighbors: [GUEST_B, tomato.id, UNKNOWN] },
    { ...ownPlant(GUEST_B, 'Alte Sorte'), badNeighbors: [GUEST_A], archived: true },
  ],
  overrides: [
    { plantId: basil.id, fields: { spacingInRowCm: 30, goodNeighbors: [tomato.id, GUEST_A] } },
    { plantId: UNKNOWN, fields: { spacingInRowCm: 30 } },
  ],
};

describe('planCatalogImport', () => {
  it('gives own plants new ids, keeps them private and maps their neighbours', () => {
    const { own, ids } = planCatalogImport(request, [tomato, basil], {}, counter());
    expect(ids).toEqual({
      [GUEST_A]: 'NEW00000000000000000000001',
      [GUEST_B]: 'NEW00000000000000000000002',
    });
    expect(own).toEqual([
      expect.objectContaining({
        id: 'NEW00000000000000000000001',
        name: 'Haferwurzel',
        // The imported neighbour gets its new id, unknown neighbours are dropped.
        goodNeighbors: ['NEW00000000000000000000002', tomato.id],
        publicationStatus: 'PRIVATE',
        archived: false,
      }),
      expect.objectContaining({
        id: 'NEW00000000000000000000002',
        badNeighbors: ['NEW00000000000000000000001'],
        archived: true,
      }),
    ]);
  });

  it('keeps only adjustments of global plants, with global neighbours only', () => {
    const { overrides } = planCatalogImport(request, [tomato, basil], {}, counter());
    expect(overrides).toEqual([
      { plantId: basil.id, fields: { spacingInRowCm: 30, goodNeighbors: [tomato.id] } },
    ]);
  });

  it('keeps ids chosen by an earlier attempt', () => {
    const first = planCatalogImport(request, [tomato, basil], {}, counter());
    const again = planCatalogImport(request, [tomato, basil], first.ids, () => 'NEVER');
    expect(again.own).toEqual(first.own);
  });
});

import { seedPlants } from '@hochbeet/catalog-seed';
import type { CatalogPlant, Plant } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { correctionsFor, globalValues, similarPlants } from './admin';
import { plantFields } from './catalog';

const plant = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};
const request = (extra: Partial<Plant>): Plant => ({
  ...plant('Kopfsalat'),
  id: '01J9ZQ3W8D6V2K5M7N8P9R0P01',
  ...extra,
});
const names = (plants: Plant[]) => plants.map((p) => p.name);

describe('similar global plants', () => {
  it('puts similar names first, then the same family', () => {
    const similar = similarPlants(request({ name: 'Eichblattsalat' }), seedPlants);
    expect(names(similar)).toHaveLength(3);
    // Name and family match beat the family alone.
    expect(names(similar).slice(0, 2)).toEqual(['Kopfsalat', 'Pflücksalat']);
  });

  it('matches words of the name across families', () => {
    const similar = similarPlants(
      request({ name: 'Gelbe Zucchini', family: 'Unbekannt', category: 'OBST' }),
      seedPlants,
    );
    expect(names(similar)).toEqual(['Zucchini']);
  });

  it('finds nothing for an unrelated plant', () => {
    expect(
      similarPlants(request({ name: 'Yacón', family: 'Unbekannt', category: 'OBST' }), seedPlants),
    ).toEqual([]);
  });
});

describe('corrections before approval', () => {
  it('contains only the changed fields', () => {
    const requested = request({ name: 'Eichblattsalat' });
    expect(
      correctionsFor(requested, {
        ...plantFields({ ...requested, source: 'OWN', overridden: false }),
        rowSpacingCm: 35,
      }),
    ).toEqual({ rowSpacingCm: 35 });
    expect(
      correctionsFor(requested, plantFields({ ...requested, source: 'OWN', overridden: false })),
    ).toBeNull();
  });
});

describe('global values', () => {
  it('drops the admin’s own adjustment', () => {
    const lettuce = plant('Kopfsalat');
    const adjusted: CatalogPlant = {
      ...lettuce,
      spacingInRowCm: 60,
      source: 'GLOBAL',
      overridden: true,
      global: plantFields({ ...lettuce, source: 'GLOBAL', overridden: false }),
    };
    expect(globalValues(adjusted)).toMatchObject({ spacingInRowCm: 25, overridden: false });
    expect(globalValues(adjusted).global).toBeUndefined();
  });
});

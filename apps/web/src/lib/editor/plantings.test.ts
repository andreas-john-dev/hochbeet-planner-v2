import { seedPlants } from '@hochbeet/catalog-seed';
import type { Planting } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { iconSizeCm, plantPositions } from './plantings';

const plant = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};
const base = {
  id: '01J9ZQ3W8D6V2K5M7N8P9R0S2A',
  bedId: '01J9ZQ3W8D6V2K5M7N8P9R0S1T',
  plantId: 'x',
  startDate: '2026-05-04',
  endDate: null,
  removedDate: null,
};

describe('plant positions', () => {
  it('has one position for a single plant', () => {
    const planting = { ...base, kind: 'SINGLE', x: 30, y: 40 } as Planting;
    expect(plantPositions(planting, plant('Tomate'))).toEqual([{ x: 30, y: 40 }]);
  });

  it('places every plant of a row at the in-row spacing', () => {
    // Lettuce: 25 cm in the row; 100 cm give floor(100 / 25) + 1 = 5 plants.
    const planting = {
      ...base,
      kind: 'ROW',
      x: 10,
      y: 20,
      orientation: 'V',
      lengthCm: 100,
    } as Planting;
    expect(plantPositions(planting, plant('Kopfsalat'))).toEqual(
      [20, 45, 70, 95, 120].map((y) => ({ x: 10, y })),
    );
  });

  it('keeps icons readable but not huge', () => {
    expect(iconSizeCm(plant('Radieschen'))).toBe(8);
    expect(iconSizeCm(plant('Kopfsalat'))).toBe(20);
    expect(iconSizeCm(plant('Kürbis'))).toBe(24);
  });
});

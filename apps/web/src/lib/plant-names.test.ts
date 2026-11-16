import { seedPlantByName } from '@hochbeet/catalog-seed';
import type { Plant } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { byPlantName, matchesPlantName } from './plant-names';

const seed = (name: string): Plant => {
  const plant = seedPlantByName.get(name);
  if (!plant) throw new Error(name);
  return plant;
};

describe('plant names in the app', () => {
  it('sorts by the name in the language', () => {
    const plants = ['Zucchini', 'Möhre', 'Kopfsalat'].map(seed);
    expect([...plants].sort(byPlantName('de')).map((p) => p.name)).toEqual([
      'Kopfsalat',
      'Möhre',
      'Zucchini',
    ]);
    // Carrot, Courgette, Lettuce
    expect([...plants].sort(byPlantName('en')).map((p) => p.name)).toEqual([
      'Möhre',
      'Zucchini',
      'Kopfsalat',
    ]);
  });

  it('finds a plant by its German and its English name', () => {
    const lettuce = seed('Kopfsalat');
    expect(matchesPlantName(lettuce, 'kopfsalat')).toBe(true);
    expect(matchesPlantName(lettuce, ' Lettuce ')).toBe(true);
    expect(matchesPlantName(lettuce, '')).toBe(true);
    expect(matchesPlantName(lettuce, 'tomato')).toBe(false);
    const own = { name: 'Haferwurzel', family: 'Korbblütler' };
    expect(matchesPlantName(own, 'hafer')).toBe(true);
  });
});

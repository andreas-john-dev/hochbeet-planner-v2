import { seedPlants } from '@hochbeet/catalog-seed';
import type { CatalogPlant } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { EMPTY_PLANT_FORM, ownNeighbors, parsePlantForm, plantForm } from './plant-form';

const catalog: CatalogPlant[] = seedPlants.map((p) => ({
  ...p,
  source: 'GLOBAL',
  overridden: false,
}));
const onion = catalog.find((p) => p.name === 'Zwiebel');
if (!onion) throw new Error('Zwiebel');

const filled = {
  ...EMPTY_PLANT_FORM,
  name: ' Haferwurzel ',
  family: 'Korbblütler',
  feeder: 'SCHWACH' as const,
  spacingInRowCm: '10',
  rowSpacingCm: '25',
  lifecycleValue: '20',
  goodNeighbors: [onion.id],
};

describe('own plant form', () => {
  it('turns the form into plant fields, with the category icon as fallback', () => {
    expect(parsePlantForm(filled)).toEqual({
      fields: {
        name: 'Haferwurzel',
        category: 'GEMUESE',
        family: 'Korbblütler',
        feeder: 'SCHWACH',
        spacingInRowCm: 10,
        rowSpacingCm: 25,
        lifecycle: { type: 'ANNUAL', cultureWeeks: 20 },
        goodNeighbors: [onion.id],
        badNeighbors: [],
        color: '#4f9d4a',
        icon: 'category-gemuese',
      },
    });
    const herb = parsePlantForm({ ...filled, category: 'KRAUT', icon: 'dill' });
    expect('fields' in herb && herb.fields.icon).toBe('dill');
  });

  it('reports missing values per field', () => {
    expect(parsePlantForm(EMPTY_PLANT_FORM)).toEqual({
      errors: {
        name: 'Bitte gib einen Namen an.',
        family: 'Bitte gib eine Familie an.',
        spacingInRowCm: 'Bitte 1 bis 300 cm angeben.',
        rowSpacingCm: 'Bitte 1 bis 300 cm angeben.',
        lifecycleValue: 'Bitte 1 bis 104 Wochen angeben.',
      },
    });
  });

  it('round-trips an own plant', () => {
    const parsed = parsePlantForm(filled);
    if (!('fields' in parsed)) throw new Error('invalid');
    const own: CatalogPlant = {
      ...parsed.fields,
      id: '01J9ZQ3W8D6V2K5M7N8P9R0P01',
      source: 'OWN',
      overridden: false,
    };
    expect(plantForm(own)).toMatchObject({ ...filled, name: 'Haferwurzel', icon: null });
  });

  it('finds own plants among the neighbours', () => {
    const own: CatalogPlant = {
      ...onion,
      id: '01J9ZQ3W8D6V2K5M7N8P9R0P01',
      name: 'Meine Zwiebel',
      source: 'OWN',
    };
    const plant = { ...own, id: '01J9ZQ3W8D6V2K5M7N8P9R0P02', goodNeighbors: [onion.id, own.id] };
    expect(ownNeighbors(plant, [...catalog, own]).map((p) => p.name)).toEqual(['Meine Zwiebel']);
  });
});

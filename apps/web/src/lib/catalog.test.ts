import { seedPlants } from '@hochbeet/catalog-seed';
import type { CatalogPlant } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import {
  adjustForm,
  changedFields,
  families,
  filterCatalog,
  lifecycleText,
  NO_FILTER,
  overrideFor,
  parseAdjustForm,
  plantFields,
  publicationState,
} from './catalog';

const catalog: CatalogPlant[] = seedPlants.map((p) => ({
  ...p,
  source: 'GLOBAL',
  overridden: false,
}));
const plant = (name: string) => {
  const found = catalog.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};
const adjusted = (name: string, override: Partial<CatalogPlant>): CatalogPlant => {
  const global = plant(name);
  return { ...global, ...override, overridden: true, global: plantFields(global) };
};

describe('catalogue list', () => {
  it('searches names and families', () => {
    const names = (query: string) =>
      filterCatalog(catalog, { ...NO_FILTER, query }).map((p) => p.name);
    expect(names('salat')).toEqual(['Feldsalat', 'Kopfsalat', 'Pflücksalat', 'Salatgurke']);
    expect(names('dolden').length).toBeGreaterThan(3);
  });

  it('filters by category, family and feeder', () => {
    const result = filterCatalog(catalog, {
      ...NO_FILTER,
      category: 'GEMUESE',
      family: 'Nachtschattengewächse',
      feeder: 'STARK',
    });
    expect(result.map((p) => p.name)).toEqual([
      'Aubergine',
      'Chili',
      'Kartoffel',
      'Paprika',
      'Tomate',
    ]);
  });

  it('lists every family once', () => {
    expect(families(catalog)).toContain('Kreuzblütler');
    expect(new Set(families(catalog)).size).toBe(families(catalog).length);
  });

  it('describes the lifecycle in German', () => {
    expect(lifecycleText({ type: 'ANNUAL', cultureWeeks: 8 })).toBe('8 Wochen');
    expect(lifecycleText({ type: 'MULTI_YEAR', years: 3 })).toBe('3 Jahre');
    expect(lifecycleText({ type: 'PERENNIAL' })).toBe('Dauerkultur, ohne Ende');
  });
});

describe('adjustments', () => {
  it('marks the fields that differ from the global plant', () => {
    expect(changedFields(plant('Kopfsalat'))).toEqual(new Set());
    expect(changedFields(adjusted('Kopfsalat', { spacingInRowCm: 40 }))).toEqual(
      new Set(['spacingInRowCm']),
    );
  });

  it('builds the override against the global plant, not the current values', () => {
    const lettuce = adjusted('Kopfsalat', { spacingInRowCm: 40 });
    // Changing another field keeps the earlier adjustment.
    expect(overrideFor(lettuce, { feeder: 'STARK' })).toEqual({
      spacingInRowCm: 40,
      feeder: 'STARK',
    });
    // Setting a value back to the global one drops it from the override.
    expect(overrideFor(lettuce, { spacingInRowCm: 25 })).toBeNull();
    expect(
      overrideFor(plant('Kopfsalat'), { lifecycle: { type: 'ANNUAL', cultureWeeks: 10 } }),
    ).toEqual({ lifecycle: { type: 'ANNUAL', cultureWeeks: 10 } });
  });
});

describe('adjust form', () => {
  it('round-trips the plant values', () => {
    const salat = plant('Kopfsalat');
    const parsed = parseAdjustForm(adjustForm(salat));
    expect(parsed).toEqual({
      fields: {
        family: salat.family,
        feeder: salat.feeder,
        spacingInRowCm: 25,
        rowSpacingCm: 30,
        lifecycle: { type: 'ANNUAL', cultureWeeks: 8 },
      },
    });
    expect('fields' in parsed && overrideFor(salat, parsed.fields)).toBeNull();
  });

  it('reports invalid values per field', () => {
    const form = { ...adjustForm(plant('Kopfsalat')), spacingInRowCm: '0', lifecycleValue: '2,5' };
    expect(parseAdjustForm(form)).toEqual({
      errors: {
        spacingInRowCm: 'Bitte 1 bis 300 cm angeben.',
        lifecycleValue: 'Bitte 1 bis 104 Wochen angeben.',
      },
    });
  });

  it('needs no value for perennials', () => {
    const form = { ...adjustForm(plant('Kopfsalat')), lifecycleType: 'PERENNIAL' as const };
    const parsed = parseAdjustForm(form);
    expect('fields' in parsed && parsed.fields.lifecycle).toEqual({ type: 'PERENNIAL' });
  });
});

describe('publication state', () => {
  it('shows a rejection as its own state', () => {
    const own = (publication: CatalogPlant['publication']): CatalogPlant => ({
      ...plant('Kopfsalat'),
      source: 'OWN',
      publication,
    });
    expect(publicationState(own({ status: 'PRIVATE' }))).toBe('PRIVATE');
    expect(publicationState(own({ status: 'PENDING' }))).toBe('PENDING');
    expect(publicationState(own({ status: 'PRIVATE', rejectionComment: 'Doppelt' }))).toBe(
      'REJECTED',
    );
    expect(publicationState(own({ status: 'PUBLISHED' }))).toBe('PUBLISHED');
  });
});

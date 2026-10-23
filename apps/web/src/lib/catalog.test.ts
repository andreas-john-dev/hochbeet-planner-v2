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

describe('adjustments of sowing and frost', () => {
  const sowing = {
    method: 'PRESOW' as const,
    presowWeeks: { from: 10, to: 14 },
    propagationWeeks: { min: 6, max: 8 },
  };
  const withoutDetails = (name: string): CatalogPlant => {
    const { sowing: _sowing, frostSensitive: _frost, ...rest } = plant(name);
    return rest;
  };

  it('treats a missing frost flag like false', () => {
    const lettuce = withoutDetails('Kopfsalat');
    expect(overrideFor(lettuce, { frostSensitive: false })).toBeNull();
    const frosty = { ...lettuce, frostSensitive: true };
    expect(overrideFor(frosty, { frostSensitive: false })).toEqual({ frostSensitive: false });
    expect(
      changedFields({
        ...lettuce,
        frostSensitive: false,
        overridden: true,
        global: plantFields(lettuce),
      }),
    ).toEqual(new Set());
  });

  it('adds sowing details as adjustment and marks them', () => {
    const lettuce = withoutDetails('Kopfsalat');
    expect(overrideFor(lettuce, { sowing })).toEqual({ sowing });
    const withSowing: CatalogPlant = {
      ...lettuce,
      sowing,
      overridden: true,
      global: plantFields(lettuce),
    };
    expect(changedFields(withSowing)).toEqual(new Set(['sowing']));
  });

  it('falls back to the global plant when added details are removed again', () => {
    const lettuce = withoutDetails('Kopfsalat');
    const withSowing: CatalogPlant = {
      ...lettuce,
      sowing,
      spacingInRowCm: 40,
      overridden: true,
      global: plantFields(lettuce),
    };
    expect(overrideFor(withSowing, { sowing: undefined })).toEqual({ spacingInRowCm: 40 });
    expect(overrideFor({ ...withSowing, spacingInRowCm: 25 }, { sowing: undefined })).toBeNull();
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
        frostSensitive: salat.frostSensitive ?? false,
        sowing: salat.sowing,
      },
    });
    expect('fields' in parsed && overrideFor(salat, parsed.fields)).toBeNull();
  });

  it('round-trips sowing details and reports their errors separately', () => {
    const sowing = {
      method: 'DIRECT' as const,
      directSowWeeks: { from: 12, to: 30 },
      directSowExtraWeeks: 2,
    };
    const lettuce = adjusted('Kopfsalat', { frostSensitive: true, sowing });
    const parsed = parseAdjustForm(adjustForm(lettuce));
    expect('fields' in parsed && parsed.fields).toMatchObject({ frostSensitive: true, sowing });

    const form = adjustForm(lettuce);
    const invalid = { ...form, sowing: { ...form.sowing, directTo: '' } };
    expect(parseAdjustForm(invalid)).toEqual({
      errors: { sowing: { directTo: 'Bitte beide Werte angeben.' } },
    });
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

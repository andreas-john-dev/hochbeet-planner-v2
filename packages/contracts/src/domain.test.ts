import { describe, expect, it } from 'vitest';
import {
  BedSchema,
  CatalogPlantSchema,
  LifecycleSchema,
  PlantingSchema,
  PlantOverrideSchema,
  PlantSchema,
} from './domain';
import { bed, rowPlanting, singlePlanting, tomato } from './fixtures.test-utils';

describe('BedSchema', () => {
  it('accepts a valid bed', () => {
    expect(BedSchema.parse(bed)).toEqual(bed);
  });

  it('rejects sizes off the grid and duplicate renewal dates', () => {
    expect(BedSchema.safeParse({ ...bed, widthCm: 123 }).success).toBe(false);
    expect(BedSchema.safeParse({ ...bed, depthCm: 0 }).success).toBe(false);
    expect(
      BedSchema.safeParse({ ...bed, soilRenewals: ['2026-03-01', '2026-03-01'] }).success,
    ).toBe(false);
  });
});

describe('PlantingSchema', () => {
  it('accepts single plantings and rows', () => {
    expect(PlantingSchema.parse(singlePlanting)).toEqual(singlePlanting);
    expect(PlantingSchema.parse(rowPlanting)).toEqual(rowPlanting);
  });

  it('requires orientation and length only for rows', () => {
    expect(PlantingSchema.safeParse({ ...rowPlanting, lengthCm: undefined }).success).toBe(false);
    expect(PlantingSchema.safeParse({ ...rowPlanting, lengthCm: 102 }).success).toBe(false);
    const single = PlantingSchema.parse({ ...singlePlanting, orientation: 'H' });
    expect(single).not.toHaveProperty('orientation');
  });

  it('keeps positions on the grid', () => {
    expect(PlantingSchema.safeParse({ ...singlePlanting, x: 31 }).success).toBe(false);
  });

  it('starts and is removed on Mondays', () => {
    expect(PlantingSchema.safeParse({ ...singlePlanting, startDate: '2026-05-12' }).success).toBe(
      false,
    );
    expect(PlantingSchema.safeParse({ ...singlePlanting, removedDate: '2026-06-02' }).success).toBe(
      false,
    );
    expect(PlantingSchema.safeParse({ ...singlePlanting, removedDate: '2026-06-01' }).success).toBe(
      true,
    );
  });

  it('allows perennials without end date', () => {
    expect(PlantingSchema.safeParse({ ...singlePlanting, endDate: null }).success).toBe(true);
  });

  it('rejects an end before the start', () => {
    const result = PlantingSchema.safeParse({ ...singlePlanting, endDate: '2026-05-04' });
    expect(result.error?.issues[0]).toMatchObject({
      path: ['endDate'],
      message: 'Ende muss nach dem Start liegen.',
    });
  });
});

describe('PlantSchema', () => {
  it('accepts a valid plant', () => {
    expect(PlantSchema.parse(tomato)).toEqual(tomato);
  });

  it('allows spacings off the grid (e.g. 7 cm bush beans)', () => {
    expect(PlantSchema.safeParse({ ...tomato, spacingInRowCm: 7 }).success).toBe(true);
  });

  it.each([
    [{ type: 'ANNUAL', cultureWeeks: 12 }, true],
    [{ type: 'MULTI_YEAR', years: 3 }, true],
    [{ type: 'PERENNIAL' }, true],
    [{ type: 'ANNUAL' }, false],
    [{ type: 'MULTI_YEAR', cultureWeeks: 3 }, false],
  ])('lifecycle %j valid: %s', (lifecycle, valid) => {
    expect(LifecycleSchema.safeParse(lifecycle).success).toBe(valid);
  });

  it('validates colour and icon key', () => {
    expect(PlantSchema.safeParse({ ...tomato, color: 'red' }).success).toBe(false);
    expect(PlantSchema.safeParse({ ...tomato, icon: 'Tomate' }).success).toBe(false);
  });
});

describe('PlantOverrideSchema', () => {
  it('accepts any subset of plant fields, including spacings and neighbours', () => {
    expect(PlantOverrideSchema.safeParse({ spacingInRowCm: 50, badNeighbors: [] }).success).toBe(
      true,
    );
  });

  it('rejects empty overrides and unknown fields such as the id', () => {
    expect(PlantOverrideSchema.safeParse({}).success).toBe(false);
    expect(PlantOverrideSchema.safeParse({ id: tomato.id }).success).toBe(false);
  });
});

describe('CatalogPlantSchema', () => {
  it('describes own plants with publication status', () => {
    const own = {
      ...tomato,
      source: 'OWN',
      overridden: false,
      publication: { status: 'PRIVATE', rejectionComment: 'Bitte Familie ergänzen.' },
    };
    expect(CatalogPlantSchema.parse(own)).toEqual(own);
  });
});

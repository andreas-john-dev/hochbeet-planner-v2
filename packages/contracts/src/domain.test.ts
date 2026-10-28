import { describe, expect, it } from 'vitest';
import {
  BedSchema,
  CatalogPlantSchema,
  LifecycleSchema,
  PlantingSchema,
  PlantOverrideSchema,
  PlantSchema,
  SowingBatchFieldsSchema,
  SowingBatchSchema,
  SowingSchema,
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

  it('reads a planting without origin as planted out and knows direct sowing', () => {
    const { origin: _origin, ...withoutOrigin } = singlePlanting;
    expect(PlantingSchema.parse(withoutOrigin)).toEqual(singlePlanting);
    expect(PlantingSchema.parse({ ...rowPlanting, origin: 'DIRECT_SOW' }).origin).toBe(
      'DIRECT_SOW',
    );
    expect(PlantingSchema.safeParse({ ...singlePlanting, origin: 'SOWN' }).success).toBe(false);
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

describe('PlantingSchema with a sowing batch', () => {
  const sowingId = '01J9ZQ3W8D6V2K5M7N8P9R0SW1';

  it('links planted out plantings to a batch', () => {
    expect(PlantingSchema.parse({ ...rowPlanting, sowingId }).sowingId).toBe(sowingId);
    // Without origin the planting counts as planted out.
    const { origin: _, ...withoutOrigin } = singlePlanting;
    expect(PlantingSchema.safeParse({ ...withoutOrigin, sowingId }).success).toBe(true);
  });

  it('refuses a batch for direct sowing and ids that are no ULID', () => {
    const sown = PlantingSchema.safeParse({ ...singlePlanting, origin: 'DIRECT_SOW', sowingId });
    expect(sown.error?.issues).toEqual([
      expect.objectContaining({
        path: ['sowingId'],
        message: 'Nur gepflanzte Pflanzungen stammen aus einer Anzucht.',
      }),
    ]);
    expect(PlantingSchema.safeParse({ ...singlePlanting, sowingId: 'batch' }).success).toBe(false);
  });
});

describe('SowingBatchSchema', () => {
  const batch = {
    id: '01J9ZQ3W8D6V2K5M7N8P9R0SW1',
    plantId: tomato.id,
    sowDate: '2026-03-09',
    sownCount: 12,
    aliveCount: 10,
    stage: 'PRICKED',
    location: 'Fensterbank Küche',
    plannedTransplantDate: '2026-05-18',
    notes: 'Zwei Sorten gemischt',
  } as const;
  const issues = (value: unknown) =>
    SowingBatchSchema.safeParse(value).error?.issues.map((i) => [i.path.join('.'), i.message]);

  it('accepts a full batch and one with only the required fields', () => {
    expect(SowingBatchSchema.parse(batch)).toEqual(batch);
    const { location, plannedTransplantDate, notes, ...required } = batch;
    expect(SowingBatchSchema.parse({ ...required, stage: 'PLANNED' })).toEqual({
      ...required,
      stage: 'PLANNED',
    });
    const { id, ...fields } = batch;
    expect(SowingBatchFieldsSchema.parse(batch)).toEqual(fields);
  });

  it('sows and plants out on Mondays, planting out after sowing', () => {
    expect(issues({ ...batch, sowDate: '2026-03-10' })).toEqual([
      ['sowDate', 'Muss ein Montag sein.'],
    ]);
    expect(issues({ ...batch, plannedTransplantDate: '2026-05-19' })).toEqual([
      ['plannedTransplantDate', 'Muss ein Montag sein.'],
    ]);
    expect(issues({ ...batch, plannedTransplantDate: batch.sowDate })).toEqual([
      ['plannedTransplantDate', 'Auspflanzen muss nach der Aussaat liegen.'],
    ]);
    const { id, ...fields } = batch;
    expect(
      SowingBatchFieldsSchema.safeParse({ ...fields, plannedTransplantDate: '2026-03-02' }).success,
    ).toBe(false);
  });

  it('counts whole seeds and seedlings', () => {
    expect(issues({ ...batch, sownCount: 0 })).toEqual([
      ['sownCount', '1 bis 9999 Stück angeben.'],
    ]);
    expect(issues({ ...batch, sownCount: 2.5 })).toEqual([['sownCount', 'Ganze Stück angeben.']]);
    expect(issues({ ...batch, aliveCount: -1 })).toEqual([
      ['aliveCount', '0 bis 9999 Stück angeben.'],
    ]);
    expect(issues({ ...batch, aliveCount: 0 })).toBeUndefined();
    expect(issues({ ...batch, sownCount: 10_000 })).toEqual([
      ['sownCount', '1 bis 9999 Stück angeben.'],
    ]);
  });

  it('knows the stages and limits the texts', () => {
    expect(issues({ ...batch, stage: 'PLANTED' })?.[0]?.[0]).toBe('stage');
    expect(issues({ ...batch, location: 'x'.repeat(61) })).toEqual([
      ['location', 'Höchstens 60 Zeichen.'],
    ]);
    expect(issues({ ...batch, notes: 'x'.repeat(501) })).toEqual([
      ['notes', 'Höchstens 500 Zeichen.'],
    ]);
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

describe('SowingSchema', () => {
  const presow = {
    method: 'PRESOW',
    presowWeeks: { from: 10, to: 14 },
    propagationWeeks: { min: 6, max: 8 },
    prickOutWeeks: 3,
    germinationDays: { min: 8, max: 14 },
    germinationTempC: { min: 20, max: 25 },
  } as const;
  const direct = {
    method: 'DIRECT',
    directSowWeeks: { from: 12, to: 28 },
    directSowExtraWeeks: 2,
  } as const;
  const issues = (value: unknown) =>
    SowingSchema.safeParse(value).error?.issues.map((i) => [i.path.join('.'), i.message]);

  it('accepts presowing, direct sowing and both', () => {
    expect(SowingSchema.parse(presow)).toEqual(presow);
    expect(SowingSchema.parse(direct)).toEqual(direct);
    const both = { ...presow, ...direct, method: 'BOTH' };
    expect(SowingSchema.parse(both)).toEqual(both);
  });

  it('allows windows across the turn of the year', () => {
    expect(SowingSchema.safeParse({ ...direct, directSowWeeks: { from: 40, to: 8 } }).success).toBe(
      true,
    );
  });

  it('requires the windows of the chosen method', () => {
    expect(issues({ method: 'PRESOW' })).toEqual([
      ['presowWeeks', 'Bitte die Wochen für die Vorkultur angeben.'],
      ['propagationWeeks', 'Bitte die Dauer der Vorkultur angeben.'],
    ]);
    expect(issues({ method: 'DIRECT' })).toEqual([
      ['directSowWeeks', 'Bitte die Wochen für die Direktsaat angeben.'],
    ]);
    expect(issues({ ...presow, method: 'BOTH' })).toEqual([
      ['directSowWeeks', 'Bitte die Wochen für die Direktsaat angeben.'],
    ]);
  });

  it('rejects details of the other method', () => {
    expect(issues({ ...direct, prickOutWeeks: 3 })).toEqual([
      ['prickOutWeeks', 'Nur bei Vorkultur möglich.'],
    ]);
    expect(issues({ ...presow, directSowExtraWeeks: 1 })).toEqual([
      ['directSowExtraWeeks', 'Nur bei Direktsaat möglich.'],
    ]);
  });

  it('checks weeks and ranges', () => {
    expect(issues({ ...presow, presowWeeks: { from: 0, to: 54 } })).toEqual([
      ['presowWeeks.from', 'Kalenderwoche 1 bis 53 angeben.'],
      ['presowWeeks.to', 'Kalenderwoche 1 bis 53 angeben.'],
    ]);
    expect(issues({ ...presow, propagationWeeks: { min: 8, max: 6 } })).toEqual([
      ['propagationWeeks.max', 'Bis-Wert muss mindestens so groß sein wie der Von-Wert.'],
    ]);
    expect(issues({ ...presow, germinationTempC: { min: 20, max: 45 } })).toEqual([
      ['germinationTempC.max', '0 bis 40 °C angeben.'],
    ]);
  });

  it('is optional on plants, as is frost sensitivity', () => {
    expect(PlantSchema.safeParse(tomato).success).toBe(true);
    const withSowing = { ...tomato, frostSensitive: true, sowing: presow };
    expect(PlantSchema.parse(withSowing)).toEqual(withSowing);
    expect(PlantSchema.safeParse({ ...tomato, sowing: { method: 'PRESOW' } }).success).toBe(false);
  });

  it('can be adjusted as a whole', () => {
    expect(PlantOverrideSchema.safeParse({ sowing: direct, frostSensitive: false }).success).toBe(
      true,
    );
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

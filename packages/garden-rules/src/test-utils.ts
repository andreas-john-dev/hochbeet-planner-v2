// Builders for rule tests. Ids are short strings; the rules do not validate them.
import type { Bed, Plant, Planting, SowingBatch, SowingWithPlantings } from '@hochbeet/contracts';
import { resolvePlantings, type RuleContext } from './context';
import { sowingInfos } from './sowings';

export function bed(overrides: Partial<Bed> = {}): Bed {
  return {
    id: 'bed',
    name: 'Testbeet',
    widthCm: 200,
    depthCm: 100,
    mainRowDirection: 'V',
    soilRenewals: [],
    ...overrides,
  };
}

export function plant(id: string, overrides: Partial<Plant> = {}): Plant {
  return {
    id,
    name: id,
    category: 'GEMUESE',
    family: 'Familie',
    feeder: 'MITTEL',
    spacingInRowCm: 20,
    rowSpacingCm: 20,
    lifecycle: { type: 'ANNUAL', cultureWeeks: 12 },
    goodNeighbors: [],
    badNeighbors: [],
    color: '#4a7c3a',
    icon: 'gemuese',
    ...overrides,
  };
}

const dates = {
  origin: 'TRANSPLANT',
  startDate: '2026-05-04',
  endDate: null,
  removedDate: null,
} as const;

export function single(
  id: string,
  plantId: string,
  x: number,
  y: number,
  overrides: Partial<Planting> = {},
): Planting {
  return { id, bedId: 'bed', plantId, kind: 'SINGLE', x, y, ...dates, ...overrides } as Planting;
}

export function row(
  id: string,
  plantId: string,
  x: number,
  y: number,
  orientation: 'H' | 'V',
  lengthCm: number,
  overrides: Partial<Planting> = {},
): Planting {
  return {
    id,
    bedId: 'bed',
    plantId,
    kind: 'ROW',
    x,
    y,
    orientation,
    lengthCm,
    ...dates,
    ...overrides,
  };
}

export function context(
  plants: Plant[],
  plantings: Planting[],
  bedOverrides: Partial<Bed> = {},
  lastFrost = '05-15',
  sowings: readonly SowingWithPlantings[] = [],
): RuleContext {
  return {
    bed: bed(bedOverrides),
    plantings: resolvePlantings(plantings, plants),
    lastFrost,
    sowings: sowingInfos(sowings, plants),
  };
}

/** A sowing batch with the plantings linked to it (compact form, as from the API). */
export function batch(
  id: string,
  plantId: string,
  overrides: Partial<SowingBatch> = {},
  plantings: readonly Planting[] = [],
): SowingWithPlantings {
  return {
    sowing: {
      id,
      plantId,
      sowDate: '2026-03-09',
      sownCount: 24,
      aliveCount: 18,
      stage: 'PRICKED',
      ...overrides,
    },
    plantings: plantings.map((p) =>
      p.kind === 'ROW'
        ? { id: p.id, bedId: p.bedId, startDate: p.startDate, kind: 'ROW', lengthCm: p.lengthCm }
        : { id: p.id, bedId: p.bedId, startDate: p.startDate, kind: 'SINGLE' },
    ),
  };
}

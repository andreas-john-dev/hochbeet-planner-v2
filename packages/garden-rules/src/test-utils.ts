// Builders for rule tests. Ids are short strings; the rules do not validate them.
import type { Bed, Plant, Planting } from '@hochbeet/contracts';
import { resolvePlantings, type RuleContext } from './context';

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

const dates = { startDate: '2026-05-04', endDate: null, removedDate: null };

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
): RuleContext {
  return { bed: bed(bedOverrides), plantings: resolvePlantings(plantings, plants) };
}

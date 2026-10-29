import { seedPlants } from '@hochbeet/catalog-seed';
import type { Bed } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { filterPlants } from './palette';
import {
  bedCentre,
  defaultRowLength,
  isTempId,
  moveByKey,
  newPlanting,
  rowLengthFor,
  rowLengthTo,
  singlePositions,
  snapToBed,
  sowingPlantings,
} from './placement';
import { plantCount } from '@hochbeet/garden-rules';

const plant = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};

const bed: Bed = {
  id: '01J9ZQ3W8D6V2K5M7N8P9R0S1A',
  name: 'Hochbeet',
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'V',
  soilRenewals: [],
};

// Wednesday of ISO week 41.
const today = new Date('2026-10-07T10:00:00+02:00');

describe('snapping', () => {
  it('rounds to the 5 cm grid and stays inside the bed', () => {
    expect(snapToBed({ x: 12.4, y: 47.6 }, bed)).toEqual({ x: 10, y: 50 });
    expect(snapToBed({ x: -8, y: 130 }, bed)).toEqual({ x: 0, y: 100 });
  });

  it('starts the keyboard cursor in the bed centre', () => {
    expect(bedCentre({ widthCm: 120, depthCm: 85 })).toEqual({ x: 60, y: 45 });
  });
});

describe('new planting', () => {
  it('creates a single plant on the Monday of the current week with the lifecycle end', () => {
    const p = newPlanting({
      bed,
      plant: plant('Tomate'),
      kind: 'SINGLE',
      at: { x: 40, y: 50 },
      today,
    });
    expect(p).toMatchObject({
      kind: 'SINGLE',
      bedId: bed.id,
      plantId: plant('Tomate').id,
      origin: 'TRANSPLANT',
      x: 40,
      y: 50,
      startDate: '2026-10-05',
      endDate: '2027-03-08', // 22 weeks
      removedDate: null,
    });
    expect(isTempId(p.id)).toBe(true);
  });

  it('sows directly sown plants straight into the bed', () => {
    const at = { x: 40, y: 50 };
    expect(newPlanting({ bed, plant: plant('Möhre'), kind: 'ROW', at, today })).toMatchObject({
      origin: 'DIRECT_SOW',
      endDate: '2027-01-11', // 14 weeks, no extra weeks
    });
    // Lettuce can be sown or planted; planted out is the usual way into a raised bed.
    expect(
      newPlanting({ bed, plant: plant('Kopfsalat'), kind: 'SINGLE', at, today }),
    ).toMatchObject({ origin: 'TRANSPLANT' });
  });

  it('has no end for perennials', () => {
    const p = newPlanting({
      bed,
      plant: plant('Rosmarin'),
      kind: 'SINGLE',
      at: { x: 0, y: 0 },
      today,
    });
    expect(p.endDate).toBeNull();
  });

  it('lays out rows in the main row direction of the bed', () => {
    const p = newPlanting({ bed, plant: plant('Möhre'), kind: 'ROW', at: { x: 60, y: 10 }, today });
    expect(p).toMatchObject({ kind: 'ROW', orientation: 'V', lengthCm: 50 });
    const across = newPlanting({
      bed: { ...bed, mainRowDirection: 'H' },
      plant: plant('Möhre'),
      kind: 'ROW',
      at: { x: 180, y: 10 },
      today,
    });
    expect(across).toMatchObject({ orientation: 'H', lengthCm: 20 });
  });
});

describe('row length', () => {
  it('defaults to the room to the edge, 5 to 50 cm', () => {
    expect(defaultRowLength(bed, { x: 0, y: 0 }, 'V')).toBe(50);
    expect(defaultRowLength(bed, { x: 0, y: 80 }, 'V')).toBe(20);
    expect(defaultRowLength(bed, { x: 0, y: 100 }, 'V')).toBe(5);
  });

  it('follows the handle along the row, snapped, at least 5 cm', () => {
    const row = { x: 20, y: 10, orientation: 'V' as const };
    expect(rowLengthTo(row, { x: 90, y: 108 })).toBe(100);
    expect(rowLengthTo(row, { x: 20, y: 0 })).toBe(5);
    expect(rowLengthTo({ ...row, orientation: 'H' }, { x: 143, y: 0 })).toBe(125);
  });
});

describe('keyboard placement', () => {
  it('moves 5 cm per arrow key and 25 cm with Shift', () => {
    expect(moveByKey({ x: 50, y: 50 }, 'ArrowRight', false, bed)).toEqual({ x: 55, y: 50 });
    expect(moveByKey({ x: 50, y: 50 }, 'ArrowUp', true, bed)).toEqual({ x: 50, y: 25 });
  });

  it('stops at the bed edge and ignores other keys', () => {
    expect(moveByKey({ x: 0, y: 100 }, 'ArrowLeft', true, bed)).toEqual({ x: 0, y: 100 });
    expect(moveByKey({ x: 0, y: 100 }, 'Enter', false, bed)).toBeNull();
  });
});

describe('palette', () => {
  it('filters by search text and category, sorted by name', () => {
    const names = (q: string, c: Parameters<typeof filterPlants>[2]) =>
      filterPlants(seedPlants, q, c).map((p) => p.name);
    expect(names('kohl', null)).toEqual([
      'Blumenkohl',
      'Chinakohl',
      'Grünkohl',
      'Kohlrabi',
      'Rosenkohl',
      'Rotkohl',
      'Weißkohl',
    ]);
    expect(names('', 'OBST')).toEqual(['Erdbeere']);
    expect(names('MINZE', 'KRAUT')).toEqual(['Pfefferminze']);
  });
});

describe('planting out from a sowing batch', () => {
  it('finds the shortest row for a number of plants', () => {
    // Kopfsalat, 25 cm: 6 plants need 5 gaps.
    expect(rowLengthFor(6, 25)).toBe(125);
    expect(rowLengthFor(1, 25)).toBe(5);
    // 7 cm does not fit the grid: 3 plants need 14 cm, the grid gives 15.
    expect(rowLengthFor(3, 7)).toBe(15);
    expect(rowLengthFor(10, 7)).toBe(65);
    for (const [count, spacing] of [
      [6, 25],
      [3, 7],
      [10, 7],
      [12, 30],
    ] as const) {
      expect(
        plantCount(
          { kind: 'ROW', lengthCm: rowLengthFor(count, spacing) },
          {
            spacingInRowCm: spacing,
          },
        ),
      ).toBe(count);
    }
  });

  it('never plans more plants than wanted when the grid cannot hit the number', () => {
    // 3 cm apart: 5 cm hold 2 plants, 10 cm already 4.
    expect(rowLengthFor(3, 3)).toBe(5);
    expect(rowLengthFor(2, 3)).toBe(5);
    // A single plant cannot be a row of one at 3 cm: the shortest row holds 2.
    expect(rowLengthFor(1, 3)).toBe(5);
  });

  it('spreads single plants along the row direction and starts a new row at the edge', () => {
    const lettuce = plant('Kopfsalat'); // 25 cm in the row, 30 cm between rows
    // Rows run along the depth (V): 100 cm from y = 50 hold 3 plants (50, 75, 100).
    expect(singlePositions(bed, lettuce, { x: 20, y: 50 }, 5)).toEqual([
      { x: 20, y: 50 },
      { x: 20, y: 75 },
      { x: 20, y: 100 },
      { x: 50, y: 50 },
      { x: 50, y: 75 },
    ]);
    // Across the width (H), spacing under the grid rounds up to 5 cm.
    const wide = { ...bed, mainRowDirection: 'H' as const };
    expect(
      singlePositions(wide, { spacingInRowCm: 7, rowSpacingCm: 20 }, { x: 0, y: 0 }, 3),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
  });

  it('plants out a row or single plants from the batch in the week shown', () => {
    let n = 0;
    const newId = () => `tmp-${String(++n)}`;
    const lettuce = plant('Kopfsalat');
    const common = {
      bed,
      plant: lettuce,
      sowing: { id: 'SOWING' },
      at: { x: 20, y: 0 },
      week: today,
      newId,
    };
    const [row] = sowingPlantings({ ...common, kind: 'ROW', count: 6 });
    expect(row).toEqual({
      id: 'tmp-1',
      bedId: bed.id,
      plantId: lettuce.id,
      origin: 'TRANSPLANT',
      sowingId: 'SOWING',
      kind: 'ROW',
      x: 20,
      y: 0,
      orientation: 'V',
      lengthCm: 125,
      startDate: '2026-10-05',
      // Kopfsalat stays 8 weeks.
      endDate: '2026-11-30',
      removedDate: null,
    });
    const singles = sowingPlantings({ ...common, kind: 'SINGLE', count: 3 });
    expect(singles.map((p) => [p.id, p.kind, p.y, p.sowingId])).toEqual([
      ['tmp-2', 'SINGLE', 0, 'SOWING'],
      ['tmp-3', 'SINGLE', 25, 'SOWING'],
      ['tmp-4', 'SINGLE', 50, 'SOWING'],
    ]);
  });
});

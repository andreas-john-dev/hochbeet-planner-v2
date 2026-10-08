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
  rowLengthTo,
  snapToBed,
} from './placement';

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
      x: 40,
      y: 50,
      startDate: '2026-10-05',
      endDate: '2027-03-08', // 22 weeks
      removedDate: null,
    });
    expect(isTempId(p.id)).toBe(true);
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

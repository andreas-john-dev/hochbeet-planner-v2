import type { Planting } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import {
  type CircleFootprint,
  defaultMainRowDirection,
  footprint,
  gap,
  gridCells,
  rowDirection,
  rowPlantCount,
  type StripFootprint,
} from './geometry';

const circle = (cx: number, cy: number, r: number): CircleFootprint => ({
  kind: 'circle',
  cx,
  cy,
  r,
});
const strip = (x0: number, y0: number, x1: number, y1: number): StripFootprint => ({
  kind: 'strip',
  x0,
  y0,
  x1,
  y1,
});

const base = {
  id: '01J9ZQ3W8D6V2K5M7N8P9R0S1V',
  bedId: '01J9ZQ3W8D6V2K5M7N8P9R0S1T',
  plantId: '01J9ZQ3W8D6V2K5M7N8P9R0S1W',
  startDate: '2026-05-11',
  endDate: null,
  removedDate: null,
};
const single = (x: number, y: number): Planting => ({ ...base, kind: 'SINGLE', x, y });
const row = (x: number, y: number, orientation: 'H' | 'V', lengthCm: number): Planting => ({
  ...base,
  kind: 'ROW',
  x,
  y,
  orientation,
  lengthCm,
});

describe('footprint', () => {
  const spacing = { spacingInRowCm: 10, rowSpacingCm: 30 };

  it('is a circle with half the in-row spacing for single plants', () => {
    expect(footprint(single(40, 25), spacing)).toEqual(circle(40, 25, 5));
  });

  it('is a strip along a horizontal row, overhanging half the spacing at both ends', () => {
    expect(footprint(row(20, 40, 'H', 100), spacing)).toEqual(strip(15, 25, 125, 55));
  });

  it('is a strip along a vertical row', () => {
    expect(footprint(row(20, 40, 'V', 100), spacing)).toEqual(strip(5, 35, 35, 145));
  });
});

describe('gap', () => {
  describe('circle – circle', () => {
    it('is the distance between the edges', () => {
      expect(gap(circle(30, 30, 30), circle(100, 30, 10))).toBe(30);
    });

    it('is 0 when they touch', () => {
      expect(gap(circle(0, 0, 10), circle(20, 0, 10))).toBe(0);
    });

    it('is negative when they overlap', () => {
      expect(gap(circle(30, 30, 30), circle(70, 30, 30))).toBe(-20);
    });
  });

  describe('circle – strip', () => {
    const s = strip(50, 0, 150, 60);

    it('measures to the nearest side', () => {
      expect(gap(circle(30, 30, 10), s)).toBe(10);
    });

    it('measures to the nearest corner', () => {
      expect(gap(circle(20, 100, 5), s)).toBe(45); // corner (50, 60): 3-4-5 triangle × 10
    });

    it('is negative when the circle reaches into the strip', () => {
      expect(gap(circle(45, 30, 10), s)).toBe(-5);
    });

    it('is negative when the centre lies inside the strip', () => {
      expect(gap(circle(60, 30, 10), s)).toBe(-20);
    });
  });

  describe('strip – strip', () => {
    const a = strip(0, 0, 100, 30);

    it('measures between parallel rows', () => {
      expect(gap(a, strip(0, 40, 100, 70))).toBe(10);
    });

    it('measures between corners when apart on both axes', () => {
      expect(gap(a, strip(110, 40, 200, 70))).toBeCloseTo(Math.SQRT2 * 10);
    });

    it('is 0 when they touch', () => {
      expect(gap(a, strip(100, 0, 150, 30))).toBe(0);
    });

    it('is negative when they overlap', () => {
      expect(gap(a, strip(0, 20, 100, 50))).toBe(-10);
    });
  });

  it('is symmetric', () => {
    const shapes = [
      circle(30, 30, 10),
      circle(45, 30, 10),
      strip(50, 0, 150, 60),
      strip(0, 40, 80, 70),
    ];
    for (const a of shapes) {
      for (const b of shapes) {
        expect(gap(a, b)).toBeCloseTo(gap(b, a));
      }
    }
  });
});

describe('gridCells', () => {
  it('covers the four cells around a single plant on a grid point', () => {
    expect(gridCells(circle(10, 10, 5))).toEqual([
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
    ]);
  });

  it('never returns an empty list, even for tiny plants', () => {
    expect(gridCells(circle(5, 5, 2.5))).toHaveLength(4);
  });

  it('leaves out corner cells a circle does not reach', () => {
    // Spacing 25 cm: radius 12.5; the corner (20, 20) is 14.1 cm from the centre.
    const cells = gridCells(circle(30, 30, 12.5)).map((c) => `${String(c.col)}:${String(c.row)}`);
    expect(cells).toContain('5:5');
    expect(cells).not.toContain('3:3'); // [15, 20]² lies outside the circle
  });

  it('covers a strip completely, without cells that only touch it', () => {
    const cells = gridCells(strip(15, 25, 125, 55));
    expect(cells).toHaveLength(22 * 6);
    expect(cells.some((c) => c.col === 25)).toBe(false);
  });
});

describe('rowDirection', () => {
  const bed = { mainRowDirection: 'V' } as const;

  it('uses the orientation of a row', () => {
    expect(rowDirection(row(0, 0, 'H', 50), bed)).toBe('H');
  });

  it('uses the bed direction for single plants', () => {
    expect(rowDirection(single(0, 0), bed)).toBe('V');
  });
});

describe('defaultMainRowDirection', () => {
  it('runs rows across a wide bed (parallel to the shorter edge)', () => {
    expect(defaultMainRowDirection({ widthCm: 200, depthCm: 100 })).toBe('V');
  });

  it('runs rows along the width of a deep bed', () => {
    expect(defaultMainRowDirection({ widthCm: 80, depthCm: 120 })).toBe('H');
  });
});

describe('rowPlantCount', () => {
  it.each([
    [100, 25, 5],
    [100, 30, 4],
    [100, 7, 15],
    [5, 30, 1],
  ])('a %i cm row with %i cm spacing holds %i plants', (lengthCm, spacing, count) => {
    expect(rowPlantCount(lengthCm, spacing)).toBe(count);
  });
});

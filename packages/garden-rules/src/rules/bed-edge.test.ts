import { describe, expect, it } from 'vitest';
import { context, plant, row, single } from '../test-utils';
import { bedEdgeRule } from './bed-edge';

const kohlrabi = plant('kohlrabi', { name: 'Kohlrabi', spacingInRowCm: 20, rowSpacingCm: 30 });
const bed = { widthCm: 100, depthCm: 50 };

describe('bed edge rule', () => {
  it('gives a subtle hint when a footprint reaches beyond the bed', () => {
    expect(bedEdgeRule(context([kohlrabi], [single('k', 'kohlrabi', 5, 25)], bed))).toEqual([
      {
        rule: 'BED_EDGE',
        severity: 'HINT',
        plantingIds: ['k'],
        period: { start: '2026-05-04', end: '2026-07-27' },
        message: 'Kohlrabi ragt über den Beetrand.',
      },
    ]);
  });

  it('accepts footprints that end exactly at the edge', () => {
    expect(
      bedEdgeRule(
        context(
          [kohlrabi],
          [single('a', 'kohlrabi', 10, 10), single('b', 'kohlrabi', 90, 40)],
          bed,
        ),
      ),
    ).toEqual([]);
  });

  it('checks every side of the bed', () => {
    const plantings = [
      single('left', 'kohlrabi', 5, 25),
      single('top', 'kohlrabi', 50, 5),
      single('right', 'kohlrabi', 95, 25),
      single('bottom', 'kohlrabi', 50, 45),
    ];
    expect(bedEdgeRule(context([kohlrabi], plantings, bed)).map((f) => f.plantingIds[0])).toEqual([
      'left',
      'top',
      'right',
      'bottom',
    ]);
  });

  it('flags a row that no longer fits after the bed was made smaller', () => {
    const findings = bedEdgeRule(
      context([kohlrabi], [row('r', 'kohlrabi', 10, 15, 'H', 120)], { widthCm: 100, depthCm: 50 }),
    );
    expect(findings).toHaveLength(1);
  });

  it('flags plantings that lie completely outside', () => {
    expect(bedEdgeRule(context([kohlrabi], [single('k', 'kohlrabi', 150, 25)], bed))).toHaveLength(
      1,
    );
  });
});

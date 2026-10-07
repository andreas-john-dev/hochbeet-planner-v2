import { describe, expect, it } from 'vitest';
import { INFLUENCE_RADIUS_CM } from '../constants';
import { context, plant, row, single } from '../test-utils';
import { neighborsRule } from './neighbors';

// Values and neighbour lists from docs/startkatalog.md (only the pairs used here).
const tomato = plant('tomate', {
  name: 'Tomate',
  spacingInRowCm: 60,
  rowSpacingCm: 60,
  goodNeighbors: ['kopfsalat'],
  badNeighbors: ['kartoffel'],
});
const potato = plant('kartoffel', {
  name: 'Kartoffel',
  spacingInRowCm: 30,
  rowSpacingCm: 60,
  badNeighbors: ['tomate'],
});
const lettuce = plant('kopfsalat', {
  name: 'Kopfsalat',
  spacingInRowCm: 25,
  rowSpacingCm: 30,
  goodNeighbors: ['tomate'],
});
const parsley = plant('petersilie', { name: 'Petersilie', spacingInRowCm: 20, rowSpacingCm: 20 });
const plants = [tomato, potato, lettuce, parsley];

// Tomato at (30, 30) has radius 30; a plant with radius r at x = 60 + r + gap is `gap` cm away.
const run = (...plantings: Parameters<typeof context>[1]) =>
  neighborsRule(context(plants, plantings));

describe('neighbour rule', () => {
  it('warns for tomato next to potato', () => {
    expect(run(single('t', 'tomate', 30, 30), single('k', 'kartoffel', 90, 30))).toEqual([
      {
        rule: 'BAD_NEIGHBOR',
        severity: 'WARNING',
        plantingIds: ['k', 't'],
        period: { start: '2026-05-04', end: '2026-07-27' },
        message: 'Kartoffel und Tomate sind schlechte Nachbarn.',
      },
    ]);
  });

  it('gives a positive hint for tomato next to lettuce', () => {
    expect(run(single('t', 'tomate', 30, 30), single('s', 'kopfsalat', 85, 30))).toEqual([
      {
        rule: 'GOOD_NEIGHBOR',
        severity: 'POSITIVE',
        plantingIds: ['s', 't'],
        period: { start: '2026-05-04', end: '2026-07-27' },
        message: 'Kopfsalat und Tomate sind gute Nachbarn.',
      },
    ]);
  });

  it('works when only one side lists the pair', () => {
    const onlyTomato = plant('kartoffel', { ...potato, badNeighbors: [] });
    const findings = neighborsRule(
      context(
        [tomato, onlyTomato],
        [single('t', 'tomate', 30, 30), single('k', 'kartoffel', 90, 30)],
      ),
    );
    expect(findings.map((f) => f.rule)).toEqual(['BAD_NEIGHBOR']);
  });

  it('lets the warning win when one side says good and the other bad', () => {
    const contradicting = plant('kopfsalat', { ...lettuce, badNeighbors: ['tomate'] });
    const findings = neighborsRule(
      context(
        [tomato, contradicting],
        [single('t', 'tomate', 30, 30), single('s', 'kopfsalat', 85, 30)],
      ),
    );
    expect(findings.map((f) => [f.rule, f.severity])).toEqual([['BAD_NEIGHBOR', 'WARNING']]);
  });

  describe(`influence radius of ${String(INFLUENCE_RADIUS_CM)} cm`, () => {
    // Potato radius 15: x = 60 + 15 + gap.
    it('applies below 30 cm gap', () => {
      expect(run(single('t', 'tomate', 30, 30), single('k', 'kartoffel', 104, 30))).toHaveLength(1); // 29 cm
    });

    it('does not apply at exactly 30 cm', () => {
      expect(run(single('t', 'tomate', 30, 30), single('k', 'kartoffel', 105, 30))).toEqual([]);
    });

    it('applies to overlapping footprints as well', () => {
      expect(run(single('t', 'tomate', 30, 30), single('k', 'kartoffel', 60, 30))).toHaveLength(1);
    });

    it('measures between rows, not plant centres', () => {
      // Lettuce row 20 cm beside a tomato row (both horizontal).
      const findings = run(
        row('t', 'tomate', 30, 30, 'H', 120),
        row('s', 'kopfsalat', 15, 95, 'H', 120),
      );
      expect(findings.map((f) => f.rule)).toEqual(['GOOD_NEIGHBOR']);
    });
  });

  it('ignores plants without relation', () => {
    expect(run(single('t', 'tomate', 30, 30), single('p', 'petersilie', 75, 30))).toEqual([]);
  });

  it('only compares plantings that are in the bed at the same time', () => {
    expect(
      run(
        single('t', 'tomate', 30, 30, { endDate: '2026-07-06' }),
        single('k', 'kartoffel', 90, 30, { startDate: '2026-07-06' }),
      ),
    ).toEqual([]);
  });

  it('is symmetric in the order of the plantings', () => {
    const a = single('t', 'tomate', 30, 30);
    const b = single('k', 'kartoffel', 90, 30);
    expect(run(b, a)).toEqual(run(a, b));
  });
});

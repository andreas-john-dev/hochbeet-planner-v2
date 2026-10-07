import { describe, expect, it } from 'vitest';
import { resolvePlantings } from '../context';
import { context, plant, row, single } from '../test-utils';
import { spacingRule } from './spacing';

const tomato = plant('tomate', { name: 'Tomate', spacingInRowCm: 60, rowSpacingCm: 80 });
const basil = plant('basilikum', { name: 'Basilikum', spacingInRowCm: 20, rowSpacingCm: 20 });
const lettuce = plant('salat', { name: 'Kopfsalat', spacingInRowCm: 30, rowSpacingCm: 30 });
const plants = [tomato, basil, lettuce];

describe('spacing rule', () => {
  it('warns when two footprints overlap', () => {
    const findings = spacingRule(
      context(plants, [single('t', 'tomate', 30, 30), single('b', 'basilikum', 60, 30)]),
    );
    expect(findings).toEqual([
      {
        rule: 'SPACING',
        severity: 'WARNING',
        plantingIds: ['b', 't'],
        period: { start: '2026-05-04', end: '2026-07-27' },
        message: 'Tomate und Basilikum stehen zu eng: Die Standflächen überlappen um 10 cm.',
      },
    ]);
  });

  it('does not warn when the footprints only touch', () => {
    expect(
      spacingRule(
        context(plants, [single('t', 'tomate', 30, 30), single('b', 'basilikum', 70, 30)]),
      ),
    ).toEqual([]);
    // Neighbouring rows exactly one row spacing apart.
    expect(
      spacingRule(
        context(plants, [
          row('r1', 'salat', 15, 15, 'H', 120),
          row('r2', 'salat', 15, 45, 'H', 120),
        ]),
      ),
    ).toEqual([]);
  });

  it('never warns within a row', () => {
    // Five lettuces 30 cm apart in one row: one footprint, nothing to compare.
    expect(spacingRule(context(plants, [row('r', 'salat', 15, 15, 'H', 120)]))).toEqual([]);
  });

  it('warns for a single plant placed inside a row', () => {
    const findings = spacingRule(
      context(plants, [row('r', 'salat', 15, 15, 'H', 120), single('b', 'basilikum', 60, 20)]),
    );
    expect(findings.map((f) => f.plantingIds)).toEqual([['b', 'r']]);
  });

  describe('only checks plantings that are in the bed at the same time', () => {
    it('ignores a successor on the same spot', () => {
      const findings = spacingRule(
        context(plants, [
          single('t', 'tomate', 30, 30, { startDate: '2026-05-04', endDate: '2026-08-03' }),
          single('s', 'salat', 30, 30, { startDate: '2026-08-03' }),
        ]),
      );
      expect(findings).toEqual([]);
    });

    it('ignores a planting removed before the other starts', () => {
      const findings = spacingRule(
        context(plants, [
          single('t', 'tomate', 30, 30, { removedDate: '2026-06-01' }),
          single('s', 'salat', 30, 30, { startDate: '2026-06-01' }),
        ]),
      );
      expect(findings).toEqual([]);
    });

    it('reports the shared time as period', () => {
      const [finding] = spacingRule(
        context(plants, [
          single('t', 'tomate', 30, 30, { startDate: '2026-05-04', endDate: '2026-08-03' }),
          single('s', 'salat', 40, 30, { startDate: '2026-07-06' }),
        ]),
      );
      expect(finding?.period).toEqual({ start: '2026-07-06', end: '2026-08-03' });
    });

    it('keeps the period open for perennials', () => {
      const rosemary = plant('rosmarin', { name: 'Rosmarin', lifecycle: { type: 'PERENNIAL' } });
      const [finding] = spacingRule(
        context(
          [rosemary],
          [
            single('a', 'rosmarin', 30, 30),
            single('b', 'rosmarin', 40, 30, { startDate: '2027-04-05' }),
          ],
        ),
      );
      expect(finding?.period).toEqual({ start: '2027-04-05', end: null });
    });
  });

  it('gives the same result regardless of order', () => {
    const plantings = [single('t', 'tomate', 30, 30), single('b', 'basilikum', 60, 30)];
    const forward = spacingRule(context(plants, plantings));
    const backward = spacingRule(context(plants, [...plantings].reverse()));
    expect(backward.map((f) => f.plantingIds)).toEqual(forward.map((f) => f.plantingIds));
  });

  it('skips plantings whose plant is unknown', () => {
    expect(resolvePlantings([single('x', 'unbekannt', 0, 0)], plants)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { evaluateBed } from './engine';
import { bed, plant, single } from './test-utils';

const tomato = plant('tomate', {
  name: 'Tomate',
  family: 'Nachtschattengewächse',
  feeder: 'STARK',
  spacingInRowCm: 60,
  rowSpacingCm: 60,
  badNeighbors: ['kartoffel'],
  goodNeighbors: ['basilikum'],
});
const potato = plant('kartoffel', {
  name: 'Kartoffel',
  family: 'Nachtschattengewächse',
  feeder: 'STARK',
  spacingInRowCm: 30,
  rowSpacingCm: 60,
});
const basil = plant('basilikum', {
  name: 'Basilikum',
  family: 'Lippenblütler',
  spacingInRowCm: 20,
});
const plants = [tomato, potato, basil];

describe('evaluateBed', () => {
  // Tomato x 0..60, potato x 50..80 (overlaps by 10), basil x 70..90 (10 cm beside the
  // tomato) from June, and a potato at the bed edge.
  const plantings = [
    single('t', 'tomate', 30, 30),
    single('k', 'kartoffel', 65, 30),
    single('b', 'basilikum', 80, 30, { startDate: '2026-06-01' }),
    single('e', 'kartoffel', 190, 80),
  ];

  it('runs all rules and sorts warnings before hints and positive hints', () => {
    const findings = evaluateBed(bed(), plantings, plants);
    expect(findings.map((f) => [f.severity, f.rule, f.plantingIds.join('+')])).toEqual([
      ['WARNING', 'BAD_NEIGHBOR', 'k+t'],
      // Tomato and potato overlap on both axes: the spacing rule covers it, not HEAVY_FEEDER.
      ['WARNING', 'SPACING', 'b+k'],
      ['WARNING', 'SPACING', 'k+t'],
      ['HINT', 'BED_EDGE', 'e'],
      ['POSITIVE', 'GOOD_NEIGHBOR', 'b+t'],
    ]);
  });

  it('filters to findings that apply in a given week', () => {
    // Basil starts in June: its hints are not there in May.
    const may = evaluateBed(bed(), plantings, plants, { week: '2026-05-13' });
    expect(may.some((f) => f.plantingIds.includes('b'))).toBe(false);
    expect(may.map((f) => f.rule)).toEqual(['BAD_NEIGHBOR', 'SPACING', 'BED_EDGE']);
    const june = evaluateBed(bed(), plantings, plants, { week: new Date(2026, 5, 3) });
    expect(june).toHaveLength(5);
    expect(evaluateBed(bed(), plantings, plants, { week: '2027-01-06' })).toEqual([]);
  });

  it('still uses the whole history for crop rotation when filtering to a week', () => {
    const earlier = single('t1', 'tomate', 30, 30, {
      startDate: '2026-04-06',
      endDate: '2026-06-01',
    });
    const later = single('t2', 'tomate', 30, 30, {
      startDate: '2026-06-01',
      endDate: '2026-09-07',
    });
    const findings = evaluateBed(bed(), [earlier, later], plants, { week: '2026-07-15' });
    expect(findings.map((f) => f.rule)).toEqual(['CROP_ROTATION']);
  });

  it('returns nothing for an empty bed and skips unknown plants', () => {
    expect(evaluateBed(bed(), [], plants)).toEqual([]);
    expect(evaluateBed(bed(), [single('x', 'unbekannt', 30, 30)], plants)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { BED_RULES, evaluateBed, type EvaluateOptions, ruleIdsInScope } from './engine';
import { RULE_IDS } from './findings';
import { batch, bed, plant, single } from './test-utils';

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

// Tomato x 0..60, potato x 50..80 (overlaps by 10), basil x 70..90 (10 cm beside the
// tomato) from June, and a potato at the bed edge.
const plantings = [
  single('t', 'tomate', 30, 30),
  single('k', 'kartoffel', 65, 30),
  single('b', 'basilikum', 80, 30, { startDate: '2026-06-01' }),
  single('e', 'kartoffel', 190, 80),
];

describe('evaluateBed', () => {
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

  it('hints at frost sensitive plants before the last frost, 15 May unless given', () => {
    // Started Monday 4 May 2026; the tomato becomes frost sensitive here.
    const frosty = [{ ...tomato, frostSensitive: true }, potato, basil];
    const frost = (lastFrost?: string) =>
      evaluateBed(bed(), [single('t', 'tomate', 30, 30)], frosty, lastFrost ? { lastFrost } : {})
        .filter((f) => f.rule === 'FROST')
        .map((f) => f.message);
    expect(frost()).toEqual([
      'Tomate ist frostempfindlich und sollte erst nach dem 15. Mai ins Beet.',
    ]);
    expect(frost('04-20')).toEqual([]);
    expect(frost('05-04')).toEqual([
      'Tomate ist frostempfindlich und sollte erst nach dem 4. Mai ins Beet.',
    ]);
    // Without frost sensitive plants nothing changes.
    expect(evaluateBed(bed(), plantings, plants, { lastFrost: '06-30' })).toEqual(
      evaluateBed(bed(), plantings, plants),
    );
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

  it('writes texts in the given language, German by default, with the same params', () => {
    const german = evaluateBed(bed(), plantings, plants);
    const english = evaluateBed(bed(), plantings, plants, { locale: 'en' });
    expect(evaluateBed(bed(), plantings, plants, { locale: 'de' })).toEqual(german);
    expect(english.map((f) => f.message)).toEqual([
      'Kartoffel and Tomate are bad neighbours.',
      'Basilikum and Kartoffel are too close: their footprints overlap by 10 cm.',
      'Kartoffel and Tomate are too close: their footprints overlap by 10 cm.',
      'Kartoffel reaches beyond the edge of the bed.',
      'Basilikum and Tomate are good neighbours.',
    ]);
    expect(english.map(({ message: _, ...rest }) => rest)).toEqual(
      german.map(({ message: _, ...rest }) => rest),
    );
  });

  it('names plants through plantName, sorting pairs by that name', () => {
    const names: Record<string, string> = {
      tomate: 'Tomato',
      kartoffel: 'Potato',
      basilikum: 'Basil',
    };
    const findings = evaluateBed(bed(), plantings, plants, {
      locale: 'en',
      plantName: (p) => names[p.id] ?? p.name,
    });
    expect(findings.find((f) => f.rule === 'BAD_NEIGHBOR')).toMatchObject({
      params: { plants: ['Potato', 'Tomato'] },
      message: 'Potato and Tomato are bad neighbours.',
    });
  });

  it('returns nothing for an empty bed and skips unknown plants', () => {
    expect(evaluateBed(bed(), [], plants)).toEqual([]);
    expect(evaluateBed(bed(), [single('x', 'unbekannt', 30, 30)], plants)).toEqual([]);
  });
});

describe('rule list', () => {
  it('assigns every rule code to exactly one rule, which decides whether it is time dependent', () => {
    const ids = BED_RULES.flatMap((entry) => entry.ids);
    expect([...ids].sort()).toEqual([...RULE_IDS].sort());
    for (const entry of BED_RULES) expect(typeof entry.timeDependent).toBe('boolean');
  });

  it('keeps the spatial rules for the simple view', () => {
    expect(ruleIdsInScope('SIMPLE')).toEqual([
      'SPACING',
      'BAD_NEIGHBOR',
      'GOOD_NEIGHBOR',
      'HEAVY_FEEDER',
      'BED_EDGE',
    ]);
    expect(ruleIdsInScope('ALL')).toEqual(BED_RULES.flatMap((entry) => entry.ids));
  });
});

describe('evaluateBed with scope SIMPLE', () => {
  const simple = (week: string): EvaluateOptions => ({ scope: 'SIMPLE', week });

  it('finds no crop rotation problems', () => {
    const earlier = single('t1', 'tomate', 30, 30, {
      startDate: '2026-04-06',
      endDate: '2026-06-01',
    });
    const later = single('t2', 'tomate', 30, 30, {
      startDate: '2026-06-01',
      endDate: '2026-09-07',
    });
    const all = evaluateBed(bed(), [earlier, later], plants, { week: '2026-07-15' });
    expect(all.map((f) => f.rule)).toEqual(['CROP_ROTATION']);
    expect(evaluateBed(bed(), [earlier, later], plants, simple('2026-07-15'))).toEqual([]);
  });

  it('finds no frost problems', () => {
    const frosty = [{ ...tomato, frostSensitive: true }];
    const plantings = [single('t', 'tomate', 30, 30)]; // from Monday 4 May 2026
    const all = evaluateBed(bed(), plantings, frosty, { week: '2026-05-04' });
    expect(all.map((f) => f.rule)).toEqual(['FROST']);
    expect(evaluateBed(bed(), plantings, frosty, simple('2026-05-04'))).toEqual([]);
  });

  it('finds no sowing problems at planted out seedlings', () => {
    const raised = {
      ...basil,
      sowing: {
        method: 'PRESOW' as const,
        presowWeeks: { from: 10, to: 30 },
        propagationWeeks: { min: 3, max: 4 },
      },
    };
    // Sown 9 March, out after two weeks (three needed), and more planned than alive.
    const plantings = [
      single('b', 'basilikum', 50, 50, { startDate: '2026-03-23', sowingId: 's' }),
    ];
    const sowings = [batch('s', 'basilikum', { aliveCount: 0 }, plantings)];
    const options = { sowings, lastFrost: '01-01' };
    const all = evaluateBed(bed(), plantings, [raised], { ...options, week: '2026-03-23' });
    expect(all.map((f) => f.rule)).toEqual(['OVERPLANNED', 'TRANSPLANT_EARLY']);
    expect(
      evaluateBed(bed(), plantings, [raised], { ...options, scope: 'SIMPLE', week: '2026-03-23' }),
    ).toEqual([]);
  });

  it('finds the same with the spatial rules as ALL for that week', () => {
    for (const week of ['2026-05-13', '2026-06-03', '2027-01-06']) {
      expect(evaluateBed(bed(), plantings, plants, simple(week))).toEqual(
        evaluateBed(bed(), plantings, plants, { week }),
      );
    }
    expect(evaluateBed(bed(), plantings, plants, simple('2026-06-03'))).toHaveLength(5);
  });

  it('only counts the plantings of that week', () => {
    // The two tomatoes overlap, but one after the other: never both in the bed.
    const plantings = [
      single('t1', 'tomate', 30, 30, { startDate: '2026-04-06', endDate: '2026-06-01' }),
      single('t2', 'tomate', 40, 30, { startDate: '2026-06-01', endDate: '2026-09-07' }),
      single('e', 'kartoffel', 190, 80, { startDate: '2026-08-03' }),
    ];
    expect(evaluateBed(bed(), plantings, plants, simple('2026-05-11'))).toEqual([]);
    expect(
      evaluateBed(bed(), plantings, plants, simple('2026-08-05')).map((f) => f.plantingIds),
    ).toEqual([['e']]);
  });

  it('needs a week', () => {
    const options = { scope: 'SIMPLE' } as unknown as EvaluateOptions;
    expect(() => evaluateBed(bed(), [], plants, options)).toThrow(/needs a week/);
  });
});

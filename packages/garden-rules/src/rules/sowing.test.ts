import type { Sowing } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { evaluateSowings } from '../engine';
import { batch, context, plant, row, single } from '../test-utils';
import { sowingRule } from './sowing';

const raised: Sowing = {
  method: 'BOTH',
  presowWeeks: { from: 10, to: 30 },
  propagationWeeks: { min: 3, max: 4 },
  directSowWeeks: { from: 13, to: 30 },
};
// 25 cm apart: a 125 cm row holds 6 plants.
const lettuce = plant('lettuce', { name: 'Kopfsalat', spacingInRowCm: 25, sowing: raised });
const carrot = plant('carrot', {
  name: 'Möhre',
  sowing: { method: 'DIRECT', directSowWeeks: { from: 10, to: 29 } },
});
const tomato = plant('tomato', {
  name: 'Tomate',
  frostSensitive: true,
  sowing: {
    method: 'PRESOW',
    presowWeeks: { from: 11, to: 16 },
    propagationWeeks: { min: 7, max: 13 },
  },
});
const plants = [lettuce, carrot, tomato];

/** A lettuce planted out from batch `s` (sown Monday 9 March 2026) on `startDate`. */
const out = (id: string, startDate: string, extra = {}) =>
  single(id, 'lettuce', 50, 50, { startDate, sowingId: 's', ...extra });
const findings = (...plantings: ReturnType<typeof out>[]) =>
  sowingRule(context(plants, plantings, {}, '05-15', [batch('s', 'lettuce', {}, plantings)]));
const rules = (...plantings: ReturnType<typeof out>[]) => findings(...plantings).map((f) => f.rule);

describe('sowing rule at plantings', () => {
  it('warns when seedlings go out before the shortest raising time', () => {
    // 2 weeks after sowing, 3 needed.
    expect(findings(out('a', '2026-03-23'))).toEqual([
      {
        rule: 'TRANSPLANT_EARLY',
        severity: 'WARNING',
        plantingIds: ['a'],
        // The planting stays 12 weeks.
        period: { start: '2026-03-23', end: '2026-06-15' },
        message:
          'Kopfsalat wurde nach 2 Wochen Anzucht ausgepflanzt, braucht aber mindestens 3 Wochen.',
      },
    ]);
    // Exactly the shortest time is fine.
    expect(rules(out('a', '2026-03-30'))).toEqual([]);
  });

  it('hints when seedlings stayed more than two weeks past the longest raising time', () => {
    // Longest 4 weeks plus 2: 6 weeks are still fine, 7 are not.
    expect(rules(out('a', '2026-04-20'))).toEqual([]);
    expect(findings(out('a', '2026-04-27'))).toEqual([
      expect.objectContaining({
        rule: 'TRANSPLANT_LATE',
        severity: 'HINT',
        message: 'Kopfsalat stand 7 Wochen in der Anzucht, üblich sind 3–4 Wochen.',
      }),
    ]);
  });

  it('warns at all linked plantings when more is planned over all beds than is alive', () => {
    const inRow = row('r', 'lettuce', 0, 0, 'H', 125, { startDate: '2026-04-06', sowingId: 's' });
    const elsewhere = { ...out('x', '2026-04-06'), bedId: 'other' };
    const extra = out('b', '2026-04-13');
    // Batch: 18 alive; 6 in the row, 12 singles in another bed: exactly the stock.
    const twelve = Array.from({ length: 12 }, (_, i) => ({ ...elsewhere, id: `x${String(i)}` }));
    const ctx = (alive: number, here: ReturnType<typeof out>[]) =>
      context(plants, here, {}, '05-15', [
        batch('s', 'lettuce', { aliveCount: alive }, [...here, ...twelve]),
      ]);
    expect(sowingRule(ctx(18, [inRow]))).toEqual([]);
    // One more single in this bed: 19 planned.
    expect(sowingRule(ctx(18, [inRow, extra]))).toEqual([
      {
        rule: 'OVERPLANNED',
        severity: 'WARNING',
        plantingIds: ['b', 'r'],
        // From the row's start to the single plant's end.
        period: { start: '2026-04-06', end: '2026-07-06' },
        message: 'Aus der Anzucht Kopfsalat (KW 11) sind 19 verplant, aber nur 18 vorhanden.',
      },
    ]);
  });

  it('does not count done batches as overplanned', () => {
    const planted = out('a', '2026-04-06');
    const done = batch('s', 'lettuce', { stage: 'DONE', aliveCount: 0 }, [planted]);
    expect(sowingRule(context(plants, [planted], {}, '05-15', [done]))).toEqual([]);
  });

  it('ignores unknown or deleted batches, plants without raising time and plantings without batch', () => {
    expect(rules(out('a', '2026-03-16', { sowingId: 'gone' }))).toEqual([]);
    expect(rules(out('a', '2026-03-16', { sowingId: undefined }))).toEqual([]);
    const sown = single('c', 'carrot', 50, 50, { startDate: '2026-03-16', sowingId: 'm' });
    const carrots = batch('m', 'carrot', {}, [sown]);
    expect(sowingRule(context(plants, [sown], {}, '05-15', [carrots]))).toEqual([]);
    // Without batches the rule has nothing to say.
    expect(sowingRule(context(plants, [out('a', '2026-03-16')]))).toEqual([]);
  });
});

describe('findings at sowing batches', () => {
  const of = (...items: ReturnType<typeof batch>[]) => evaluateSowings(items, plants);

  it('hints at sowing outside the raising window', () => {
    // KW 11 is within KW 10–30, KW 37 is not.
    expect(of(batch('s', 'lettuce'))).toEqual([]);
    expect(of(batch('s', 'lettuce', { sowDate: '2026-09-07' }))).toEqual([
      {
        rule: 'SOWING_WINDOW',
        severity: 'HINT',
        sowingId: 's',
        message: 'Kopfsalat wird üblicherweise in KW 10–30 vorgezogen, gesät ist in KW 37.',
      },
    ]);
  });

  it('hints at raising a plant that is only sown directly', () => {
    expect(of(batch('m', 'carrot'))).toEqual([
      {
        rule: 'SOWING_DIRECT',
        severity: 'HINT',
        sowingId: 'm',
        message: 'Möhre wird direkt gesät und verträgt Umpflanzen schlecht.',
      },
    ]);
  });

  it('warns when more is planned than alive, not when it is exactly the stock', () => {
    const six = row('r', 'lettuce', 0, 0, 'H', 125, { sowingId: 's' });
    expect(of(batch('s', 'lettuce', { aliveCount: 6 }, [six]))).toEqual([]);
    expect(of(batch('s', 'lettuce', { aliveCount: 5 }, [six]))).toEqual([
      {
        rule: 'OVERPLANNED',
        severity: 'WARNING',
        sowingId: 's',
        message: 'Mehr in Beeten verplant als vorhanden: 6 verplant, aber nur 5 vorhanden.',
      },
    ]);
  });

  it('hints at planting out a frost sensitive plant on or before the last frost', () => {
    const planned = (date: string) =>
      batch('t', 'tomato', { sowDate: '2026-03-16', plannedTransplantDate: date });
    expect(of(planned('2026-05-11'))).toEqual([
      {
        rule: 'TRANSPLANT_FROST',
        severity: 'HINT',
        sowingId: 't',
        message: 'Tomate ist frostempfindlich: Auspflanzen erst nach dem 15. Mai planen.',
      },
    ]);
    expect(of(planned('2026-05-18'))).toEqual([]);
    expect(evaluateSowings([planned('2026-05-18')], plants, { lastFrost: '05-20' })).toHaveLength(
      1,
    );
  });

  it('says nothing about done batches or unknown plants', () => {
    expect(of(batch('m', 'carrot', { stage: 'DONE' }))).toEqual([]);
    expect(of(batch('u', 'unknown', { aliveCount: 0 }, [out('a', '2026-04-06')]))).toEqual([]);
  });

  it('lists warnings first, then by rule and batch', () => {
    const six = row('r', 'lettuce', 0, 0, 'H', 125, { sowingId: 'b' });
    const result = of(
      batch('m', 'carrot'),
      batch('b', 'lettuce', { aliveCount: 1, sowDate: '2026-09-07' }, [six]),
    );
    expect(result.map((f) => [f.severity, f.rule, f.sowingId])).toEqual([
      ['WARNING', 'OVERPLANNED', 'b'],
      ['HINT', 'SOWING_DIRECT', 'm'],
      ['HINT', 'SOWING_WINDOW', 'b'],
    ]);
  });
});

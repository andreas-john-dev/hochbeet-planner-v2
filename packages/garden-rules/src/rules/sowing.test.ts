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
        params: { plant: 'Kopfsalat', weeks: 2, minWeeks: 3 },
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
        params: { plant: 'Kopfsalat', sowWeek: 11, planned: 19, stock: 18, stage: 'PRICKED' },
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
        params: { plant: 'Kopfsalat', from: 10, to: 30, sowWeek: 37 },
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
        params: { plant: 'Möhre' },
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
        params: { planned: 6, stock: 5, stage: 'PRICKED' },
        message: 'Mehr in Beeten verplant als vorhanden: 6 verplant, aber nur 5 vorhanden.',
      },
    ]);
  });

  it('counts the seeds before germination, the seedlings after', () => {
    const six = row('r', 'lettuce', 0, 0, 'H', 125, { sowingId: 's' });
    // Nothing alive yet: planned or sown seeds are the stock.
    const seeds = { sownCount: 8, aliveCount: 0 };
    expect(of(batch('s', 'lettuce', { ...seeds, stage: 'PLANNED' }, [six]))).toEqual([]);
    expect(of(batch('s', 'lettuce', { ...seeds, stage: 'SOWN' }, [six]))).toEqual([]);
    expect(
      of(batch('s', 'lettuce', { sownCount: 5, aliveCount: 0, stage: 'PLANNED' }, [six])),
    ).toEqual([
      expect.objectContaining({
        rule: 'OVERPLANNED',
        message: 'Mehr in Beeten verplant als vorhanden: 6 verplant, aber nur 5 geplant.',
      }),
    ]);
    const sown = of(batch('s', 'lettuce', { sownCount: 5, aliveCount: 0, stage: 'SOWN' }, [six]));
    expect(sown.map((f) => f.message)).toEqual([
      'Mehr in Beeten verplant als vorhanden: 6 verplant, aber nur 5 gesät.',
    ]);
    // After germination only the seedlings alive count.
    expect(
      of(batch('s', 'lettuce', { sownCount: 8, aliveCount: 5, stage: 'GERMINATED' }, [six])),
    ).toEqual([expect.objectContaining({ rule: 'OVERPLANNED' })]);
  });

  it('hints at planting out a frost sensitive plant on or before the last frost', () => {
    const planned = (date: string) =>
      batch('t', 'tomato', { sowDate: '2026-03-16', plannedTransplantDate: date });
    expect(of(planned('2026-05-11'))).toEqual([
      {
        rule: 'TRANSPLANT_FROST',
        severity: 'HINT',
        sowingId: 't',
        params: { plant: 'Tomate', lastFrost: '05-15' },
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

describe('sowing texts in English', () => {
  const en = (...plantings: ReturnType<typeof out>[]) =>
    sowingRule(
      context(plants, plantings, {}, '05-15', [batch('s', 'lettuce', {}, plantings)], 'en'),
    ).map((f) => f.message);
  const ofEn = (...items: ReturnType<typeof batch>[]) =>
    evaluateSowings(items, plants, { locale: 'en' }).map((f) => f.message);

  it('writes the findings at plantings in English', () => {
    expect(en(out('a', '2026-03-23'))).toEqual([
      'Kopfsalat was planted out after 2 weeks indoors but needs at least 3 weeks.',
    ]);
    expect(en(out('a', '2026-04-27'))).toEqual([
      'Kopfsalat stayed indoors for 7 weeks; 3–4 weeks are usual.',
    ]);
    const six = row('r', 'lettuce', 0, 0, 'H', 125, { startDate: '2026-04-06', sowingId: 's' });
    const few = batch('s', 'lettuce', { aliveCount: 5 }, [six]);
    expect(
      sowingRule(context(plants, [six], {}, '05-15', [few], 'en')).map((f) => f.message),
    ).toEqual(['Seedlings of Kopfsalat (week 11): 6 planned, but only 5 available.']);
  });

  it('writes the findings at batches in English', () => {
    expect(ofEn(batch('s', 'lettuce', { sowDate: '2026-09-07' }))).toEqual([
      'Kopfsalat is usually started indoors in weeks 10–30; this was sown in week 37.',
    ]);
    expect(ofEn(batch('m', 'carrot'))).toEqual([
      'Möhre is sown directly and does not transplant well.',
    ]);
    const six = row('r', 'lettuce', 0, 0, 'H', 125, { sowingId: 's' });
    expect(
      ofEn(batch('s', 'lettuce', { sownCount: 5, aliveCount: 0, stage: 'PLANNED' }, [six])),
    ).toEqual(['More planned in beds than available: 6 planned, but only 5 to be sown.']);
    expect(
      ofEn(batch('s', 'lettuce', { sownCount: 5, aliveCount: 0, stage: 'SOWN' }, [six])),
    ).toEqual(['More planned in beds than available: 6 planned, but only 5 sown.']);
    expect(
      ofEn(batch('t', 'tomato', { sowDate: '2026-03-16', plannedTransplantDate: '2026-05-11' })),
    ).toEqual(['Tomate is frost-sensitive: plan to plant out only after 15 May.']);
  });

  it('keeps the params of a finding in every language', () => {
    const items = [batch('s', 'lettuce', { sowDate: '2026-09-07' }), batch('m', 'carrot')];
    const params = (locale: 'de' | 'en') =>
      evaluateSowings(items, plants, { locale }).map((f) => f.params);
    expect(params('en')).toEqual(params('de'));
  });
});

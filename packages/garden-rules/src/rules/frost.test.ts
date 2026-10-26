import { describe, expect, it } from 'vitest';
import { context, plant, single } from '../test-utils';
import { frostRule } from './frost';

const tomato = plant('tomato', {
  name: 'Tomate',
  frostSensitive: true,
  lifecycle: { type: 'ANNUAL', cultureWeeks: 20 },
});
const kohlrabi = plant('kohlrabi', { name: 'Kohlrabi' });

const planted = (startDate: string, plantId = 'tomato', id = 't') =>
  single(id, plantId, 50, 50, { startDate });
const hints = (startDate: string, lastFrost?: string, plantId?: string) =>
  frostRule(context([tomato, kohlrabi], [planted(startDate, plantId)], {}, lastFrost));

describe('frost rule', () => {
  it('hints at a frost sensitive plant that goes into the bed before the last frost', () => {
    // Monday 11 May 2026, before 15 May.
    expect(hints('2026-05-11')).toEqual([
      {
        rule: 'FROST',
        severity: 'HINT',
        plantingIds: ['t'],
        period: { start: '2026-05-11', end: '2026-09-28' },
        message: 'Tomate ist frostempfindlich und sollte erst nach dem 15. Mai ins Beet.',
      },
    ]);
    expect(hints('2026-03-30')).toHaveLength(1);
  });

  it('counts the frost day itself as too early, the day after as fine', () => {
    // 18 May 2026 is a Monday.
    expect(hints('2026-05-18', '05-18')).toHaveLength(1);
    expect(hints('2026-05-18', '05-17')).toEqual([]);
    // After 15 May.
    expect(hints('2026-05-18')).toEqual([]);
  });

  it('leaves plants alone that stand frost', () => {
    expect(hints('2026-04-06', undefined, 'kohlrabi')).toEqual([]);
    expect(
      frostRule(context([{ ...tomato, frostSensitive: false }], [planted('2026-04-06')])),
    ).toEqual([]);
  });

  it('uses the user’s last frost', () => {
    expect(hints('2026-05-04', '04-20')).toEqual([]);
    expect(hints('2026-05-25', '05-29')[0]?.message).toBe(
      'Tomate ist frostempfindlich und sollte erst nach dem 29. Mai ins Beet.',
    );
  });

  it('compares with the frost of the year the planting starts in', () => {
    // Starts after the frost and stays over the turn of the year: no hint.
    expect(hints('2026-10-05')).toEqual([]);
    // Starts in January, before that year's frost.
    expect(hints('2027-01-04')).toEqual([
      expect.objectContaining({ period: { start: '2027-01-04', end: '2027-05-24' } }),
    ]);
  });

  it('gives one hint per planting', () => {
    const plantings = [planted('2026-04-06', 'tomato', 'a'), planted('2026-04-13', 'tomato', 'b')];
    expect(frostRule(context([tomato], plantings)).map((f) => f.plantingIds)).toEqual([
      ['a'],
      ['b'],
    ]);
  });
});

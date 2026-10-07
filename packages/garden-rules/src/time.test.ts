import type { Lifecycle } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import {
  effectiveEnd,
  formatWeek,
  intersect,
  hasSoilRenewalBetween,
  isActiveInWeek,
  lifecycleEnd,
  overlaps,
  plantingInterval,
  soilRenewalsIn,
  weekInterval,
  weekStart,
} from './time';

const annual = (cultureWeeks: number): { lifecycle: Lifecycle } => ({
  lifecycle: { type: 'ANNUAL', cultureWeeks },
});
const strawberry = { lifecycle: { type: 'MULTI_YEAR', years: 3 } } satisfies {
  lifecycle: Lifecycle;
};
const rosemary = { lifecycle: { type: 'PERENNIAL' } } satisfies { lifecycle: Lifecycle };

const planted = (
  startDate: string,
  endDate: string | null = null,
  removedDate: string | null = null,
) => ({
  startDate,
  endDate,
  removedDate,
});

describe('lifecycle end', () => {
  it('adds the culture weeks for annuals', () => {
    expect(lifecycleEnd('2026-05-11', annual(12).lifecycle)).toBe('2026-08-03');
  });

  it('ends a strawberry after exactly 3 years', () => {
    expect(effectiveEnd(planted('2026-04-06'), strawberry)).toBe('2029-04-06');
    const span = plantingInterval(planted('2026-04-06'), strawberry);
    expect(isActiveInWeek(span, '2029-04-02')).toBe(true); // week of 2 – 8 April 2029
    expect(isActiveInWeek(span, '2029-04-09')).toBe(false);
  });

  it('never ends rosemary', () => {
    expect(effectiveEnd(planted('2026-04-06'), rosemary)).toBeNull();
    expect(isActiveInWeek(plantingInterval(planted('2026-04-06'), rosemary), '2046-06-01')).toBe(
      true,
    );
  });

  it('lets endDate beat the lifecycle and removedDate beat both', () => {
    expect(effectiveEnd(planted('2026-05-11', '2026-07-06'), annual(12))).toBe('2026-07-06');
    expect(effectiveEnd(planted('2026-05-11', '2026-07-06', '2026-06-01'), annual(12))).toBe(
      '2026-06-01',
    );
    expect(effectiveEnd(planted('2026-04-06', null, '2027-10-04'), rosemary)).toBe('2027-10-04');
  });

  it('accepts a removal after the planned end (removal always wins)', () => {
    expect(effectiveEnd(planted('2026-05-11', '2026-07-06', '2026-08-03'), annual(12))).toBe(
      '2026-08-03',
    );
  });
});

describe('overlaps', () => {
  it('detects shared days', () => {
    expect(
      overlaps({ start: '2026-05-04', end: '2026-07-06' }, { start: '2026-06-01', end: null }),
    ).toBe(true);
  });

  it('treats a planting ending on the start Monday of the next as successive', () => {
    expect(
      overlaps(
        { start: '2026-04-06', end: '2026-06-01' },
        { start: '2026-06-01', end: '2026-08-03' },
      ),
    ).toBe(false);
  });

  it('handles open-ended spans on both sides', () => {
    expect(overlaps({ start: '2026-04-06', end: null }, { start: '2030-01-07', end: null })).toBe(
      true,
    );
    expect(
      overlaps({ start: '2030-01-07', end: null }, { start: '2026-04-06', end: '2026-06-01' }),
    ).toBe(false);
  });

  it('is symmetric', () => {
    const spans = [
      { start: '2026-04-06', end: '2026-06-01' },
      { start: '2026-06-01', end: null },
      { start: '2026-05-04', end: '2026-05-11' },
    ];
    for (const a of spans) for (const b of spans) expect(overlaps(a, b)).toBe(overlaps(b, a));
  });
});

describe('intersect', () => {
  it('returns the shared days', () => {
    expect(
      intersect({ start: '2026-05-04', end: '2026-08-03' }, { start: '2026-07-06', end: null }),
    ).toEqual({
      start: '2026-07-06',
      end: '2026-08-03',
    });
  });

  it('stays open when both are open', () => {
    expect(
      intersect({ start: '2026-05-04', end: null }, { start: '2027-04-05', end: null }),
    ).toEqual({
      start: '2027-04-05',
      end: null,
    });
  });

  it('returns null without shared days', () => {
    expect(
      intersect({ start: '2026-05-04', end: '2026-06-01' }, { start: '2026-06-01', end: null }),
    ).toBeNull();
  });
});

describe('weeks', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sunday
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekInterval('2026-10-07')).toEqual({ start: '2026-10-05', end: '2026-10-12' });
  });

  it('filters plantings to the chosen week', () => {
    const span = { start: '2026-05-11', end: '2026-08-03' };
    expect(isActiveInWeek(span, '2026-05-11')).toBe(true);
    expect(isActiveInWeek(span, '2026-08-02')).toBe(true); // last Sunday
    expect(isActiveInWeek(span, '2026-08-03')).toBe(false); // end is exclusive
    expect(isActiveInWeek(span, '2026-05-10')).toBe(false);
  });

  it('spans the turn of the year', () => {
    expect(weekInterval('2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-04' });
    expect(isActiveInWeek({ start: '2026-10-05', end: '2026-12-31' }, '2027-01-02')).toBe(true);
  });
});

describe('formatWeek', () => {
  it('formats a week within one month', () => {
    expect(formatWeek('2026-10-07').label).toBe('5. – 11. Oktober 2026 · KW 41');
  });

  it('formats a week spanning two months', () => {
    expect(formatWeek('2026-04-01')).toEqual({
      range: '30. März – 5. April 2026',
      week: 'KW 14',
      label: '30. März – 5. April 2026 · KW 14',
    });
  });

  it('formats week 1 starting in the previous year', () => {
    expect(formatWeek('2026-01-01').label).toBe('29. Dezember 2025 – 4. Januar 2026 · KW 1');
  });

  it('formats week 53 of a long ISO year', () => {
    expect(formatWeek('2026-12-31').label).toBe('28. Dezember 2026 – 3. Januar 2027 · KW 53');
    expect(formatWeek('2027-01-03').week).toBe('KW 53');
    expect(formatWeek('2027-01-04').label).toBe('4. – 10. Januar 2027 · KW 1');
  });

  it('accepts Date objects', () => {
    expect(formatWeek(new Date(2026, 9, 7)).week).toBe('KW 41');
  });
});

describe('soil renewal and seasons', () => {
  const defaultBed = { soilRenewals: [] };

  it('renews on 1 March of every year without own entry', () => {
    expect(soilRenewalsIn(defaultBed, 2027)).toEqual(['2027-03-01']);
    expect(hasSoilRenewalBetween(defaultBed, '2026-09-28', '2027-04-05')).toBe(true);
    expect(hasSoilRenewalBetween(defaultBed, '2026-04-06', '2026-09-28')).toBe(false);
  });

  it('counts a renewal on the boundary days', () => {
    expect(hasSoilRenewalBetween(defaultBed, '2026-03-01', '2026-03-01')).toBe(true);
    expect(hasSoilRenewalBetween(defaultBed, '2026-01-05', '2026-03-01')).toBe(true);
  });

  it('uses the own dates of a year instead of 1 March', () => {
    const bed = { soilRenewals: ['2027-07-05'] };
    expect(soilRenewalsIn(bed, 2027)).toEqual(['2027-07-05']);
    expect(soilRenewalsIn(bed, 2028)).toEqual(['2028-03-01']);
    expect(hasSoilRenewalBetween(bed, '2027-02-01', '2027-04-05')).toBe(false);
  });

  describe('garlic over winter', () => {
    // Summer crop until end of September, garlic from October to July, then onions.
    const summerCropEnd = '2026-09-28';
    const garlic = { start: '2026-10-05', end: '2027-07-05' };
    const onionStart = '2027-07-12';

    it('stays in the season of the summer crop before it', () => {
      expect(hasSoilRenewalBetween(defaultBed, summerCropEnd, garlic.start)).toBe(false);
    });

    it('keeps its successor in the same season: the default 1 March falls while garlic grows', () => {
      expect(hasSoilRenewalBetween(defaultBed, garlic.end, onionStart)).toBe(false);
    });

    it('starts a new season for the successor once the renewal is moved after the harvest', () => {
      const bed = { soilRenewals: ['2027-07-05'] };
      expect(hasSoilRenewalBetween(bed, garlic.end, onionStart)).toBe(true);
    });
  });

  it('returns false for reversed ranges', () => {
    expect(hasSoilRenewalBetween(defaultBed, '2027-04-05', '2026-09-28')).toBe(false);
  });
});

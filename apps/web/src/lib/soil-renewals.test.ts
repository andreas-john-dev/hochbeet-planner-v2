import { describe, expect, it } from 'vitest';
import { checkRenewals, renewalYears } from './soil-renewals';

describe('soil renewal years', () => {
  it('shows the default 1 March around the current year', () => {
    expect(renewalYears([], '2026-10-07')).toEqual([
      { year: 2025, own: [], fallback: '2025-03-01' },
      { year: 2026, own: [], fallback: '2026-03-01' },
      { year: 2027, own: [], fallback: '2027-03-01' },
    ]);
  });

  it('lists own dates per year and adds years that have them', () => {
    const years = renewalYears(['2026-07-20', '2023-03-15', '2026-03-01'], '2026-10-07');
    expect(years.map((y) => [y.year, y.own])).toEqual([
      [2023, ['2023-03-15']],
      [2025, []],
      [2026, ['2026-03-01', '2026-07-20']],
      [2027, []],
    ]);
  });
});

describe('checking renewals', () => {
  it('drops empty fields and sorts', () => {
    expect(checkRenewals(['2026-07-20', '', '2026-03-01'])).toEqual({
      renewals: ['2026-03-01', '2026-07-20'],
    });
  });

  it('rejects duplicates and broken dates', () => {
    expect(checkRenewals(['2026-07-20', '2026-07-20'])).toEqual({
      error: 'Ein Datum steht doppelt in der Liste.',
    });
    expect(checkRenewals(['20.07.2026'])).toEqual({ error: 'Bitte ein gültiges Datum angeben.' });
  });
});

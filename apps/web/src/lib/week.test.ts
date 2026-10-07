import { describe, expect, it } from 'vitest';
import { formatWeek } from './week';

describe('formatWeek', () => {
  it('formats a week within one month', () => {
    expect(formatWeek(new Date(2026, 9, 7))).toEqual({
      range: '5. – 11. Oktober 2026',
      week: 'KW 41',
    });
  });

  it('formats a week spanning two months', () => {
    expect(formatWeek(new Date(2026, 3, 1))).toEqual({
      range: '30. März – 5. April 2026',
      week: 'KW 14',
    });
  });

  it('formats a week spanning two years with the ISO week number', () => {
    expect(formatWeek(new Date(2026, 0, 1))).toEqual({
      range: '29. Dezember 2025 – 4. Januar 2026',
      week: 'KW 1',
    });
  });
});

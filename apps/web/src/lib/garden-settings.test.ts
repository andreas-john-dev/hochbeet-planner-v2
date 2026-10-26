import { describe, expect, it } from 'vitest';
import { daysInMonth, MONTH_NAMES, monthDay, monthDayText, toMonthDay } from './garden-settings';

describe('garden settings helpers', () => {
  it('names months and counts their days in a common year', () => {
    expect(MONTH_NAMES[0]).toBe('Januar');
    expect(MONTH_NAMES[4]).toBe('Mai');
    expect(daysInMonth(2)).toBe(28);
    expect(daysInMonth(4)).toBe(30);
    expect(daysInMonth(12)).toBe(31);
  });

  it('reads and writes month and day', () => {
    expect(monthDay('05-15')).toEqual({ month: 5, day: 15 });
    expect(toMonthDay(4, 3)).toBe('04-03');
    // A day past the month's end becomes its last day.
    expect(toMonthDay(2, 31)).toBe('02-28');
    expect(monthDayText('05-15')).toBe('15. Mai');
    expect(monthDayText('03-01')).toBe('1. März');
  });
});

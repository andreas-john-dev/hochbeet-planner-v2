import { describe, expect, it } from 'vitest';
import { daysInMonth, monthDay, monthDayText, monthNames, toMonthDay } from './garden-settings';

describe('garden settings helpers', () => {
  it('names months and counts their days in a common year', () => {
    expect(monthNames('de')[0]).toBe('Januar');
    expect(monthNames('de')[4]).toBe('Mai');
    expect(monthNames('en')[4]).toBe('May');
    expect(daysInMonth(2)).toBe(28);
    expect(daysInMonth(4)).toBe(30);
    expect(daysInMonth(12)).toBe(31);
  });

  it('reads and writes month and day', () => {
    expect(monthDay('05-15')).toEqual({ month: 5, day: 15 });
    expect(toMonthDay(4, 3)).toBe('04-03');
    // A day past the month's end becomes its last day.
    expect(toMonthDay(2, 31)).toBe('02-28');
    expect(monthDayText('05-15', 'de')).toBe('15. Mai');
    expect(monthDayText('03-01', 'de')).toBe('1. März');
    expect(monthDayText('05-15', 'en')).toBe('15 May');
    expect(monthDayText('03-01', 'en')).toBe('1 March');
  });
});

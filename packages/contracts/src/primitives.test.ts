import { describe, expect, it } from 'vitest';
import {
  GridCmSchema,
  IsoDateSchema,
  isWeekInWindow,
  MondaySchema,
  UlidSchema,
  WeekWindowSchema,
} from './primitives';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('primitives', () => {
  it('accepts grid values in 5 cm steps only', () => {
    expect(ok(GridCmSchema, 0)).toBe(true);
    expect(ok(GridCmSchema, 35)).toBe(true);
    expect(ok(GridCmSchema, 12)).toBe(false);
    expect(ok(GridCmSchema, -5)).toBe(false);
    expect(ok(GridCmSchema, 7.5)).toBe(false);
  });

  it('validates ULIDs', () => {
    expect(ok(UlidSchema, '01J9ZQ3W8D6V2K5M7N8P9R0S1T')).toBe(true);
    expect(ok(UlidSchema, '01j9zq3w8d6v2k5m7n8p9r0s1t')).toBe(false); // lower case
    expect(ok(UlidSchema, '01J9ZQ3W8D6V2K5M7N8P9R0S1I')).toBe(false); // I is not Crockford
  });

  it('validates real calendar dates', () => {
    expect(ok(IsoDateSchema, '2026-02-28')).toBe(true);
    expect(ok(IsoDateSchema, '2026-02-30')).toBe(false);
    expect(ok(IsoDateSchema, '28.02.2026')).toBe(false);
  });

  it('accepts only Mondays as week dates', () => {
    expect(ok(MondaySchema, '2026-10-05')).toBe(true);
    expect(ok(MondaySchema, '2026-10-07')).toBe(false);
    expect(MondaySchema.safeParse('2026-10-07').error?.issues[0]?.message).toBe(
      'Muss ein Montag sein.',
    );
  });

  it('accepts week windows with ISO weeks 1 to 53', () => {
    expect(ok(WeekWindowSchema, { from: 10, to: 14 })).toBe(true);
    expect(ok(WeekWindowSchema, { from: 40, to: 8 })).toBe(true);
    expect(ok(WeekWindowSchema, { from: 53, to: 53 })).toBe(true);
    expect(ok(WeekWindowSchema, { from: 0, to: 8 })).toBe(false);
    expect(ok(WeekWindowSchema, { from: 10, to: 10.5 })).toBe(false);
  });

  it('finds weeks in a window, both ends included', () => {
    const spring = { from: 10, to: 14 };
    expect([9, 10, 12, 14, 15].map((week) => isWeekInWindow(week, spring))).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it('finds weeks in a window across the turn of the year', () => {
    const winter = { from: 40, to: 8 };
    expect([39, 40, 53, 1, 8, 9].map((week) => isWeekInWindow(week, winter))).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
    ]);
  });
});

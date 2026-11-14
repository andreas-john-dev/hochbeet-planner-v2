import { describe, expect, it } from 'vitest';
import { rangeText, weekHint, windowText } from './week-window';

describe('week windows', () => {
  it('places a calendar week in the year like a seed packet', () => {
    // 2026: week 1 starts on 29 December 2025, week 10 on 2 March, week 12 on 16 March.
    expect(weekHint(1, { year: 2026 })).toBe('Ende Dezember');
    expect(weekHint(10, { year: 2026 })).toBe('Anfang März');
    expect(weekHint(12, { year: 2026 })).toBe('Mitte März');
    expect(weekHint(13, { year: 2026 })).toBe('Ende März');
    // The end of week 14 is Sunday, 5 April.
    expect(weekHint(14, { year: 2026, end: true })).toBe('Anfang April');
  });

  it('describes windows, also within a single week and across the turn of the year', () => {
    expect(windowText({ from: 10, to: 14 }, 2026)).toBe('KW 10–14 (Anfang März bis Anfang April)');
    expect(windowText({ from: 20, to: 20 }, 2026)).toBe('KW 20 (Mitte Mai)');
    // Week 50 starts on 7 December 2026, week 2 ends on Sunday, 11 January.
    expect(windowText({ from: 50, to: 2 }, 2026)).toBe(
      'KW 50–2 (Anfang Dezember bis Mitte Januar)',
    );
  });

  it('writes ranges with a dash only when they span', () => {
    expect(rangeText(6, 8)).toBe('6–8');
    expect(rangeText(4, 4)).toBe('4');
  });
});

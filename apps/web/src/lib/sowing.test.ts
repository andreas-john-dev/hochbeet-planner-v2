import { describe, expect, it } from 'vitest';
import { sowingLines, weekHint, windowText } from './sowing';

describe('sowing texts', () => {
  it('places a calendar week in the year like a seed packet', () => {
    // 2026: week 1 starts on 29 December 2025, week 10 on 2 March, week 12 on 16 March.
    expect(weekHint(1, { year: 2026 })).toBe('Ende Dezember');
    expect(weekHint(10, { year: 2026 })).toBe('Anfang März');
    expect(weekHint(12, { year: 2026 })).toBe('Mitte März');
    expect(weekHint(13, { year: 2026 })).toBe('Ende März');
    // The end of week 14 is Sunday, 5 April.
    expect(weekHint(14, { year: 2026, end: true })).toBe('Anfang April');
  });

  it('describes windows, also within a single week', () => {
    expect(windowText({ from: 10, to: 14 }, 2026)).toBe('KW 10–14 (Anfang März bis Anfang April)');
    expect(windowText({ from: 20, to: 20 }, 2026)).toBe('KW 20 (Mitte Mai)');
  });

  it('lists the sowing details in German', () => {
    expect(
      sowingLines(
        {
          method: 'BOTH',
          presowWeeks: { from: 10, to: 14 },
          propagationWeeks: { min: 4, max: 6 },
          prickOutWeeks: 2,
          directSowWeeks: { from: 14, to: 32 },
          directSowExtraWeeks: 3,
          germinationDays: { min: 6, max: 12 },
          germinationTempC: { min: 18, max: 18 },
        },
        2026,
      ),
    ).toEqual([
      'Vorkultur oder Direktsaat',
      'Vorkultur KW 10–14 (Anfang März bis Anfang April)',
      '4–6 Wochen bis zum Auspflanzen',
      'Pikieren nach 2 Wochen',
      'Direktsaat KW 14–32 (Ende März bis Anfang August)',
      'Bei Direktsaat 3 Wochen länger im Beet',
      'Keimt in 6–12 Tagen',
      'Keimtemperatur 18 °C',
    ]);
  });
});

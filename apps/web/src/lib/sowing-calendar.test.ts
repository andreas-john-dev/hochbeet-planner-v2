import { seedPlants } from '@hochbeet/catalog-seed';
import type { Lifecycle, Sowing } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import {
  frostText,
  frostWeek,
  monthTicks,
  segmentPosition,
  sowingCalendar,
} from './sowing-calendar';
import { sowingFacts } from './sowing';

const seed = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};

/** The rows as `kind: segments | text` for compact expectations. */
const rows = (plant: Parameters<typeof sowingCalendar>[0], year = 2026, lastFrost?: string) =>
  sowingCalendar(plant, { year, ...(lastFrost ? { lastFrost } : {}) })?.rows.map(
    (row) =>
      `${row.kind}: ${row.segments.map((s) => `${String(s.from)}-${String(s.to)}`).join(',')} | ${row.text}`,
  );

const annual = (cultureWeeks: number): Lifecycle => ({ type: 'ANNUAL', cultureWeeks });

describe('sowing calendar', () => {
  it('draws direct sowing and the time in the bed', () => {
    // Möhre: KW 10–29, 14 weeks in the bed.
    expect(rows(seed('Möhre'))).toEqual([
      'direct: 10-29 | KW 10–29 · Anfang März bis Mitte Juli',
      'inBed: 10-42 | KW 10–42 · Anfang März bis Mitte Oktober',
    ]);
  });

  it('plants out after raising, frost sensitive plants not before the week after the frost', () => {
    // Tomate: raised KW 11–16 for 7–13 weeks would go out from KW 18; 15 May 2026 is a Friday.
    expect(rows(seed('Tomate'))).toEqual([
      'presow: 11-16 | KW 11–16 · Anfang März bis Mitte April',
      'plantOut: 21-29 | KW 21–29 · Mitte Mai bis Mitte Juli',
      'inBed: 21-50 | KW 21–50 · Mitte Mai bis Mitte Dezember',
    ]);
    // A later frost date moves planting out and the time in the bed.
    expect(rows(seed('Tomate'), 2026, '05-29')).toContain(
      'plantOut: 23-29 | KW 23–29 · Anfang Juni bis Mitte Juli',
    );
    // Not frost sensitive: right after raising.
    expect(rows({ ...seed('Tomate'), frostSensitive: false })).toContain(
      'plantOut: 18-29 | KW 18–29 · Ende April bis Mitte Juli',
    );
  });

  it('keeps a window that ends before the frost at the frost week', () => {
    // Kürbis: raised KW 16–17 for 3–4 weeks would be out by KW 21 anyway, so only KW 21.
    expect(rows(seed('Kürbis'))).toEqual([
      'presow: 16-17 | KW 16–17 · Mitte April bis Ende April',
      'direct: 20-25 | KW 20–25 · Mitte Mai bis Ende Juni',
      'plantOut: 21-21 | KW 21 · Mitte Mai',
      // Sown directly it stays 3 weeks longer: 25 + 20 + 3 - 1.
      'inBed: 20-47 | KW 20–47 · Mitte Mai bis Ende November',
    ]);
  });

  it('joins raised and direct sown plantings in the bed', () => {
    // Kopfsalat: planted out KW 13–34 for 8 weeks, sown KW 13–30 for 8 + 3 weeks.
    expect(rows(seed('Kopfsalat'))).toContain(
      'inBed: 13-41 | KW 13–41 · Ende März bis Mitte Oktober',
    );
  });

  it('splits spans over the turn of the year but names them as one', () => {
    // Knoblauch: sown in autumn, 38 weeks in the bed; 2026 has 53 ISO weeks.
    expect(rows(seed('Knoblauch'))).toEqual([
      'direct: 40-46 | KW 40–46 · Ende September bis Mitte November',
      'inBed: 1-30,40-53 | KW 40–30 · Ende September bis Ende Juli',
    ]);
    const winter: Sowing = {
      method: 'PRESOW',
      presowWeeks: { from: 48, to: 4 },
      propagationWeeks: { min: 6, max: 8 },
    };
    // 2027 has 52 weeks: raised KW 48–4 goes out KW 2–12 of the next year.
    expect(rows({ sowing: winter, lifecycle: annual(10) }, 2027)).toEqual([
      'presow: 1-4,48-52 | KW 48–4 · Ende November bis Ende Januar',
      'plantOut: 2-12 | KW 2–12 · Mitte Januar bis Ende März',
      'inBed: 2-21 | KW 2–21 · Mitte Januar bis Ende Mai',
    ]);
  });

  it('runs to the end of the year for plants that stay', () => {
    expect(rows(seed('Oregano'))?.at(-1)).toBe('inBed: 14-53 | ab KW 14 · Ende März, mehrjährig');
    expect(rows({ ...seed('Möhre'), lifecycle: annual(60) })?.at(-1)).toBe(
      'inBed: 1-53 | ganzjährig',
    );
  });

  it('treats week 53 as the last week of a 52-week year', () => {
    const late: Sowing = { method: 'DIRECT', directSowWeeks: { from: 50, to: 53 } };
    expect(rows({ sowing: late, lifecycle: annual(2) }, 2027)).toEqual([
      'direct: 50-52 | KW 50–52 · Mitte Dezember bis Anfang Januar',
      'inBed: 1-1,50-52 | KW 50–1 · Mitte Dezember bis Anfang Januar',
    ]);
  });

  it('has nothing to draw without sowing details', () => {
    expect(sowingCalendar(seed('Erdbeere'), { year: 2026 })).toBeNull();
  });
});

describe('calendar helpers', () => {
  it('finds the first week after the last frost', () => {
    expect(frostWeek(2026)).toBe(21); // Fri 15 May → Mon 18 May
    expect(frostWeek(2027)).toBe(20); // Sat 15 May → Mon 17 May
    expect(frostWeek(2022)).toBe(20); // Sun 15 May → Mon 16 May
    expect(frostText()).toBe('Frostempfindlich, erst nach dem 15. Mai ins Freie');
  });

  it('places segments and months on the band', () => {
    expect(segmentPosition({ from: 1, to: 53 }, 53)).toEqual({ left: 0, width: 100 });
    const ticks = monthTicks(2026);
    expect(ticks.map((t) => t.label)).toEqual([
      'Jan',
      'Feb',
      'Mär',
      'Apr',
      'Mai',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Okt',
      'Nov',
      'Dez',
    ]);
    // ISO week 1 of 2026 starts on Monday 29 December 2025.
    expect(ticks[0]?.left).toBeCloseTo((3 / 371) * 100);
    expect(ticks.every((t, i) => i === 0 || t.left > (ticks[i - 1]?.left ?? 0))).toBe(true);
  });

  it('lists the facts the bars do not show', () => {
    const lettuce = seed('Kopfsalat').sowing;
    if (!lettuce) throw new Error('no sowing');
    expect(sowingFacts(lettuce)).toEqual([
      '3–4 Wochen bis zum Auspflanzen',
      'Bei Direktsaat 3 Wochen länger im Beet',
      expect.stringMatching(/^Keimt in \d+–\d+ Tagen$/),
      expect.stringMatching(/^Keimtemperatur \d+–\d+ °C$/),
    ]);
  });
});

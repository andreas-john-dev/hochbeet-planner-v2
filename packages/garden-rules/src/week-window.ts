import type { WeekWindow } from '@hochbeet/contracts';
import { addDays, format, setISOWeek, startOfISOWeek } from 'date-fns';
import { de } from 'date-fns/locale';

/** Monday of an ISO week in the given year; week 53 of a 52-week year runs into January. */
function mondayOf(week: number, year: number): Date {
  // 4 January always lies in ISO week 1.
  return startOfISOWeek(setISOWeek(new Date(year, 0, 4), week));
}

/**
 * Rough position of an ISO week in the year, as on seed packets: "Anfang März". Uses the
 * Monday, or with `end` the Sunday, so that the end of a window reads right.
 */
export function weekHint(
  week: number,
  {
    year = new Date().getFullYear(),
    end = false,
  }: { year?: number | undefined; end?: boolean } = {},
): string {
  const day = addDays(mondayOf(week, year), end ? 6 : 0);
  const date = day.getDate();
  const part = date <= 10 ? 'Anfang' : date <= 20 ? 'Mitte' : 'Ende';
  return `${part} ${format(day, 'LLLL', { locale: de })}`;
}

/** "6" or "6–8", for weeks, days and degrees. */
export const rangeText = (min: number, max: number) =>
  min === max ? String(min) : `${String(min)}–${String(max)}`;

/**
 * A sowing window readable for people and the assistant: "KW 10–14 (Anfang März bis Anfang
 * April)". Shared by the app and the assistant's catalogue tools.
 */
export function windowText(window: WeekWindow, year?: number): string {
  const from = weekHint(window.from, { year });
  if (window.from === window.to) return `KW ${String(window.from)} (${from})`;
  const to = weekHint(window.to, { year, end: true });
  return `KW ${rangeText(window.from, window.to)} (${from} bis ${to})`;
}

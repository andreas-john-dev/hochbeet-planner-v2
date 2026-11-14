import type { WeekWindow } from '@hochbeet/contracts';
import { addDays, format, setISOWeek, startOfISOWeek } from 'date-fns';
import type { RulesLocale } from './locale';
import { messagesFor } from './messages';

/** Monday of an ISO week in the given year; week 53 of a 52-week year runs into January. */
function mondayOf(week: number, year: number): Date {
  // 4 January always lies in ISO week 1.
  return startOfISOWeek(setISOWeek(new Date(year, 0, 4), week));
}

interface HintOptions {
  year?: number | undefined;
  end?: boolean;
  /** Language of the text; German by default. */
  locale?: RulesLocale | undefined;
}

/**
 * Rough position of an ISO week in the year, as on seed packets: "Anfang März" or "early
 * March". Uses the Monday, or with `end` the Sunday, so that the end of a window reads right.
 */
export function weekHint(
  week: number,
  { year = new Date().getFullYear(), end = false, locale }: HintOptions = {},
): string {
  const texts = messagesFor(locale);
  const day = addDays(mondayOf(week, year), end ? 6 : 0);
  const date = day.getDate();
  const part = date <= 10 ? 'early' : date <= 20 ? 'mid' : 'late';
  return texts.weekHint(part, format(day, 'LLLL', { locale: texts.dateLocale }));
}

/** "6" or "6–8", for weeks, days and degrees. */
export const rangeText = (min: number, max: number) =>
  min === max ? String(min) : `${String(min)}–${String(max)}`;

/**
 * A sowing window readable for people and the assistant: "KW 10–14 (Anfang März bis Anfang
 * April)", in English "weeks 10–14 (early March to early April)". Shared by the app and the
 * assistant's catalogue tools (German there).
 */
export function windowText(window: WeekWindow, year?: number, locale?: RulesLocale): string {
  const texts = messagesFor(locale);
  const from = weekHint(window.from, { year, locale });
  const range = rangeText(window.from, window.to);
  if (window.from === window.to) return texts.windowText({ range, from });
  return texts.windowText({ range, from, to: weekHint(window.to, { year, end: true, locale }) });
}

import { format } from 'date-fns';
import { dateLocale, type Language } from './language';

/** "Januar" … "Dezember" (or "January" …), index 0 = January. */
export function monthNames(language: Language): string[] {
  return Array.from({ length: 12 }, (_, month) =>
    format(new Date(2001, month, 1), 'LLLL', { locale: dateLocale(language) }),
  );
}

/** Days of a month in a common year: the settings hold days that exist every year. */
export function daysInMonth(month: number): number {
  return new Date(2001, month, 0).getDate();
}

/** `MM-DD` as numbers, e.g. `05-15` → { month: 5, day: 15 }. */
export function monthDay(value: string): { month: number; day: number } {
  const [month = 1, day = 1] = value.split('-').map(Number);
  return { month, day };
}

/** Month and day as `MM-DD`; a day past the end of the month becomes its last day. */
export function toMonthDay(month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(month)}-${pad(Math.min(day, daysInMonth(month)))}`;
}

/** `05-15` → "15. Mai" or "15 May". */
export function monthDayText(value: string, language: Language): string {
  const { month, day } = monthDay(value);
  return format(new Date(2001, month - 1, day), language === 'de' ? 'd. MMMM' : 'd MMMM', {
    locale: dateLocale(language),
  });
}

import {
  endOfISOWeek,
  format,
  getISOWeek,
  isSameMonth,
  isSameYear,
  startOfISOWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';

export interface WeekLabel {
  /** Date range of the ISO week, e.g. "30. März – 5. April 2026". */
  range: string;
  /** ISO week number, e.g. "KW 14". */
  week: string;
}

/** Labels the ISO week (Monday to Sunday) that contains `date`. */
export function formatWeek(date: Date): WeekLabel {
  const start = startOfISOWeek(date);
  const end = endOfISOWeek(date);
  const startPattern = isSameYear(start, end)
    ? isSameMonth(start, end)
      ? 'd.'
      : 'd. MMMM'
    : 'd. MMMM yyyy';

  return {
    range: `${format(start, startPattern, { locale: de })} – ${format(end, 'd. MMMM yyyy', { locale: de })}`,
    week: `KW ${String(getISOWeek(date))}`,
  };
}

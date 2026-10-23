import type { Sowing, SowingMethod, WeekWindow } from '@hochbeet/contracts';
import { addDays, format, setISOWeek, startOfISOWeek } from 'date-fns';
import { de } from 'date-fns/locale';

export const SOWING_METHOD_LABEL: Record<SowingMethod, string> = {
  DIRECT: 'Direktsaat',
  PRESOW: 'Vorkultur',
  BOTH: 'Vorkultur oder Direktsaat',
};

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

const range = (min: number, max: number) =>
  min === max ? String(min) : `${String(min)}–${String(max)}`;

/** "KW 10–14 (Anfang März bis Anfang April)". */
export function windowText(window: WeekWindow, year?: number): string {
  const from = weekHint(window.from, { year });
  if (window.from === window.to) return `KW ${String(window.from)} (${from})`;
  const to = weekHint(window.to, { year, end: true });
  return `KW ${range(window.from, window.to)} (${from} bis ${to})`;
}

/** The sowing details as short German lines, e.g. for the plant page. */
export function sowingLines(sowing: Sowing, year?: number): string[] {
  const lines = [SOWING_METHOD_LABEL[sowing.method]];
  if (sowing.presowWeeks) lines.push(`Vorkultur ${windowText(sowing.presowWeeks, year)}`);
  if (sowing.propagationWeeks) {
    const { min, max } = sowing.propagationWeeks;
    lines.push(`${range(min, max)} Wochen bis zum Auspflanzen`);
  }
  if (sowing.prickOutWeeks !== undefined) {
    lines.push(`Pikieren nach ${String(sowing.prickOutWeeks)} Wochen`);
  }
  if (sowing.directSowWeeks) lines.push(`Direktsaat ${windowText(sowing.directSowWeeks, year)}`);
  if (sowing.directSowExtraWeeks) {
    lines.push(`Bei Direktsaat ${String(sowing.directSowExtraWeeks)} Wochen länger im Beet`);
  }
  if (sowing.germinationDays) {
    const { min, max } = sowing.germinationDays;
    lines.push(`Keimt in ${range(min, max)} Tagen`);
  }
  if (sowing.germinationTempC) {
    const { min, max } = sowing.germinationTempC;
    lines.push(`Keimtemperatur ${range(min, max)} °C`);
  }
  return lines;
}

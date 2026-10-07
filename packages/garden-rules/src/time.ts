import type { Bed, IsoDate, Lifecycle, Plant, Planting } from '@hochbeet/contracts';
import {
  addWeeks,
  addYears,
  endOfISOWeek,
  format,
  formatISO,
  getISOWeek,
  getYear,
  isSameMonth,
  isSameYear,
  parseISO,
  startOfISOWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';

// All dates are calendar dates (`YYYY-MM-DD`). ISO strings compare correctly as strings.

const toDate = (iso: IsoDate) => parseISO(iso);
const toIso = (date: Date): IsoDate => formatISO(date, { representation: 'date' });

/**
 * Time span of a planting: `[start, end)`, i.e. `end` is the first day it is no longer in the
 * bed. `end === null` means open-ended (perennials). Plantings that end on the Monday another
 * one starts do not overlap.
 */
export interface Interval {
  start: IsoDate;
  end: IsoDate | null;
}

/** End derived from the lifecycle alone: start + culture weeks / years, none for perennials. */
export function lifecycleEnd(start: IsoDate, lifecycle: Lifecycle): IsoDate | null {
  switch (lifecycle.type) {
    case 'ANNUAL':
      return toIso(addWeeks(toDate(start), lifecycle.cultureWeeks));
    case 'MULTI_YEAR':
      return toIso(addYears(toDate(start), lifecycle.years));
    case 'PERENNIAL':
      return null;
  }
}

type DatedPlanting = Pick<Planting, 'startDate' | 'endDate' | 'removedDate'>;

/**
 * Effective end of a planting: `removedDate` beats `endDate`, which beats the lifecycle.
 * Perennials without removal never end.
 */
export function effectiveEnd(
  planting: DatedPlanting,
  plant: Pick<Plant, 'lifecycle'>,
): IsoDate | null {
  return (
    planting.removedDate ?? planting.endDate ?? lifecycleEnd(planting.startDate, plant.lifecycle)
  );
}

export function plantingInterval(
  planting: DatedPlanting,
  plant: Pick<Plant, 'lifecycle'>,
): Interval {
  return { start: planting.startDate, end: effectiveEnd(planting, plant) };
}

/** True when two spans share at least one day. */
export function overlaps(a: Interval, b: Interval): boolean {
  return (b.end === null || a.start < b.end) && (a.end === null || b.start < a.end);
}

/** Monday of the ISO week that contains `date`. */
export function weekStart(date: IsoDate | Date): IsoDate {
  return toIso(startOfISOWeek(typeof date === 'string' ? toDate(date) : date));
}

/** The ISO week (Monday to Sunday) that contains `date`, as a span. */
export function weekInterval(date: IsoDate | Date): Interval {
  const start = weekStart(date);
  return { start, end: toIso(addWeeks(toDate(start), 1)) };
}

/** True when the planting is in the bed on at least one day of the week containing `date`. */
export function isActiveInWeek(interval: Interval, date: IsoDate | Date): boolean {
  return overlaps(interval, weekInterval(date));
}

/** Month and day of the default soil renewal in years without an own entry. */
export const DEFAULT_SOIL_RENEWAL = '03-01';

/**
 * Soil renewals of a bed in a year: the bed's own dates of that year, or 1 March when it has
 * none for that year. Moving one year's renewal (e.g. after the garlic harvest) keeps the
 * default for all other years.
 */
export function soilRenewalsIn(bed: Pick<Bed, 'soilRenewals'>, year: number): IsoDate[] {
  const own = bed.soilRenewals.filter((date) => date.startsWith(`${String(year)}-`)).sort();
  return own.length > 0 ? own : [`${String(year)}-${DEFAULT_SOIL_RENEWAL}`];
}

/**
 * True when the soil was renewed on a day between `from` and `to` (both inclusive), e.g.
 * between the end of a predecessor and the start of its successor. Crop rotation only
 * warns within one season, i.e. when this is false.
 */
export function hasSoilRenewalBetween(
  bed: Pick<Bed, 'soilRenewals'>,
  from: IsoDate,
  to: IsoDate,
): boolean {
  if (to < from) return false;
  for (let year = getYear(toDate(from)); year <= getYear(toDate(to)); year++) {
    if (soilRenewalsIn(bed, year).some((date) => from <= date && date <= to)) return true;
  }
  return false;
}

export interface WeekLabel {
  /** Date range of the ISO week, e.g. "30. März – 5. April 2026". */
  range: string;
  /** ISO week number, e.g. "KW 14". */
  week: string;
  /** Both together: "30. März – 5. April 2026 · KW 14". */
  label: string;
}

/** Labels the ISO week (Monday to Sunday) that contains `date`, in German. */
export function formatWeek(date: IsoDate | Date): WeekLabel {
  const day = typeof date === 'string' ? toDate(date) : date;
  const start = startOfISOWeek(day);
  const end = endOfISOWeek(day);
  const startPattern = isSameYear(start, end)
    ? isSameMonth(start, end)
      ? 'd.'
      : 'd. MMMM'
    : 'd. MMMM yyyy';
  const range = `${format(start, startPattern, { locale: de })} – ${format(end, 'd. MMMM yyyy', { locale: de })}`;
  const week = `KW ${String(getISOWeek(day))}`;
  return { range, week, label: `${range} · ${week}` };
}

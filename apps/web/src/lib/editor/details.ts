import type { IsoDate, Plant, Planting } from '@hochbeet/contracts';
import { effectiveEnd, lifecycleEnd, weekStart } from '@hochbeet/garden-rules';
import { format, getISOWeek, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

/** A date for the detail panel, e.g. "Mo., 5. Oktober 2026 (KW 41)". */
export function formatDate(iso: IsoDate): string {
  const date = parseISO(iso);
  return `${format(date, 'EEEEEE., d. MMMM yyyy', { locale: de })} (KW ${String(getISOWeek(date))})`;
}

/** Where the end of a planting comes from, to explain it in the panel. */
export type EndSource = 'removed' | 'manual' | 'lifecycle' | 'none';

export function plantingEnd(
  planting: Planting,
  plant: Pick<Plant, 'lifecycle'>,
): { end: IsoDate | null; source: EndSource; lifecycleEnd: IsoDate | null } {
  const fromLifecycle = lifecycleEnd(planting.startDate, plant.lifecycle);
  const source: EndSource =
    planting.removedDate !== null
      ? 'removed'
      : planting.endDate !== null
        ? 'manual'
        : fromLifecycle !== null
          ? 'lifecycle'
          : 'none';
  return { end: effectiveEnd(planting, plant), source, lifecycleEnd: fromLifecycle };
}

/**
 * Removal date for "Entfernen ab": the Monday of the chosen week. Null if that is before the
 * planting starts, because it would end before it began.
 */
export function removalDate(planting: Pick<Planting, 'startDate'>, week: Date): IsoDate | null {
  const monday = weekStart(week);
  return monday < planting.startDate ? null : monday;
}

/** Checks a new end from a date field; an empty value means "end from the lifecycle". */
export function checkEnd(
  planting: Pick<Planting, 'startDate'>,
  value: string,
): { endDate: IsoDate | null } | { error: string } {
  if (value === '') return { endDate: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: 'Bitte ein gültiges Datum angeben.' };
  if (value <= planting.startDate) return { error: 'Ende muss nach dem Start liegen.' };
  return { endDate: value };
}

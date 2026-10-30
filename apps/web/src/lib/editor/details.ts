import type { IsoDate, Plant, Planting, PlantingOrigin } from '@hochbeet/contracts';
import { effectiveEnd, plannedEnd, weekStart } from '@hochbeet/garden-rules';
import { format, getISOWeek, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

/** A date for the detail panel, e.g. "Mo., 5. Oktober 2026 (KW 41)". */
export function formatDate(iso: IsoDate): string {
  const date = parseISO(iso);
  return `${format(date, 'EEEEEE., d. MMMM yyyy', { locale: de })} (KW ${String(getISOWeek(date))})`;
}

/** Where the end of a planting comes from, to explain it in the panel. */
export type EndSource = 'removed' | 'manual' | 'lifecycle' | 'none';

type TimedPlant = Pick<Plant, 'lifecycle' | 'sowing'>;

/**
 * True when the planting has no own end: none at all, or the one prefilled from the
 * lifecycle when it was added.
 */
function endFromLifecycle(planting: Planting, plant: TimedPlant): boolean {
  return planting.endDate === null || planting.endDate === plannedEnd(planting, plant);
}

export function plantingEnd(
  planting: Planting,
  plant: TimedPlant,
): { end: IsoDate | null; source: EndSource; lifecycleEnd: IsoDate | null } {
  const fromLifecycle = plannedEnd(planting, plant);
  const source: EndSource =
    planting.removedDate !== null
      ? 'removed'
      : !endFromLifecycle(planting, plant)
        ? 'manual'
        : fromLifecycle !== null
          ? 'lifecycle'
          : 'none';
  return { end: effectiveEnd(planting, plant), source, lifecycleEnd: fromLifecycle };
}

/**
 * The planting with another origin. A prefilled end moves along (direct sowing may stay
 * longer), an end set by hand stays. Direct sowing comes from no sowing batch.
 */
export function withOrigin(
  planting: Planting,
  plant: TimedPlant,
  origin: PlantingOrigin,
): Planting {
  const next = {
    ...withSowing(planting, origin === 'TRANSPLANT' ? planting.sowingId : undefined),
    origin,
  };
  if (planting.endDate === null || !endFromLifecycle(planting, plant)) return next;
  return { ...next, endDate: plannedEnd(next, plant) };
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

/** The planting from another sowing batch, or from none. */
export function withSowing(planting: Planting, sowingId: string | undefined): Planting {
  const { sowingId: _old, ...rest } = planting;
  return sowingId === undefined ? rest : { ...rest, sowingId };
}

import type { IsoDate, Plant, Planting } from '@hochbeet/contracts';
import { defaultOrigin, weekStart } from '@hochbeet/garden-rules';
import type { Change } from './history';

/**
 * A new planting in the simple view (Epic #161): it starts on the Monday of `week` (the
 * current one), has no own end (`endDate: null`, so the lifecycle ends it), comes in as the
 * plant suggests and from no sowing batch. Used for the palette, the keyboard, dragging and
 * the assistant's suggestions alike.
 */
export function simplePlanting(
  planting: Planting,
  plant: Pick<Plant, 'sowing'>,
  week: IsoDate | Date,
): Planting {
  const { sowingId: _sowing, ...rest } = planting;
  return {
    ...rest,
    origin: defaultOrigin(plant),
    startDate: weekStart(week),
    endDate: null,
    removedDate: null,
  };
}

/**
 * Removing a planting in the simple view: one that started this week is deleted, an older one
 * gets `removedDate` = Monday of `week`, so the expert view still shows it up to last week.
 */
export function simpleRemoval(planting: Planting, week: IsoDate | Date): Change {
  const monday = weekStart(week);
  return planting.startDate >= monday
    ? { before: planting, after: null }
    : { before: planting, after: { ...planting, removedDate: monday } };
}

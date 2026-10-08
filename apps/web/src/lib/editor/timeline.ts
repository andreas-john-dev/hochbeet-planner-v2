import type { IsoDate, Plant, Planting } from '@hochbeet/contracts';
import {
  footprint,
  gap,
  isActiveInWeek,
  plantingInterval,
  weekStart,
} from '@hochbeet/garden-rules';
import { addWeeks, formatISO, getMonth, getYear, parseISO } from 'date-fns';

/** Footprints closer than this count as touching, not overlapping (as in the rules). */
const EPSILON_CM = 1e-6;

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const toIso = (date: Date): IsoDate => formatISO(date, { representation: 'date' });

/** Mondays of the weeks the slider offers: all Mondays in the year of `week`. */
export function sliderWeeks(week: IsoDate): IsoDate[] {
  const year = getYear(parseISO(week));
  const weeks: IsoDate[] = [];
  for (let monday = parseISO(weekStart(`${String(year)}-01-07`)); getYear(monday) === year;) {
    weeks.push(toIso(monday));
    monday = addWeeks(monday, 1);
  }
  // The Monday of 1–6 January can fall into the year before.
  const first = parseISO(weekStart(`${String(year)}-01-01`));
  if (getYear(first) === year && weeks[0] !== toIso(first)) weeks.unshift(toIso(first));
  return weeks;
}

/** Month labels under the slider: name and position as share of the slider (0 to 1). */
export function monthMarks(weeks: readonly IsoDate[]): { label: string; at: number }[] {
  const marks: { label: string; at: number }[] = [];
  weeks.forEach((week, index) => {
    const month = getMonth(parseISO(week));
    if (marks.length === 0 || marks.at(-1)?.label !== MONTHS[month]) {
      marks.push({
        label: MONTHS[month] ?? '',
        at: weeks.length > 1 ? index / (weeks.length - 1) : 0,
      });
    }
  });
  return marks;
}

export interface PlantingWithPlant {
  planting: Planting;
  plant: Plant;
}

/** Plantings with their plant; plantings of unknown plants are left out. */
export function withPlants(
  plantings: readonly Planting[],
  plants: readonly Plant[],
): PlantingWithPlant[] {
  const byId = new Map(plants.map((p) => [p.id, p]));
  return plantings.flatMap((planting) => {
    const plant = byId.get(planting.plantId);
    return plant ? [{ planting, plant }] : [];
  });
}

export interface Ghost extends PlantingWithPlant {
  /** Was there before a planting of this week, or comes after it. */
  relation: 'before' | 'after';
}

/**
 * Faint "ghosts" for the week: for every planting in the bed that week, the planting that
 * stood at the same place directly before it and the one that follows it. "Same place"
 * means overlapping footprints; plantings at the same time are not predecessors.
 */
export function ghosts(entries: readonly PlantingWithPlant[], week: IsoDate): Ghost[] {
  const withTime = entries.map((entry) => ({
    ...entry,
    interval: plantingInterval(entry.planting, entry.plant),
    footprint: footprint(entry.planting, entry.plant),
  }));
  const active = withTime.filter((e) => isActiveInWeek(e.interval, week));
  const inactive = withTime.filter((e) => !isActiveInWeek(e.interval, week));
  const found = new Map<string, Ghost>();

  for (const current of active) {
    const here = inactive.filter((e) => gap(e.footprint, current.footprint) < -EPSILON_CM);
    const before = here
      .filter((e) => e.interval.end !== null && e.interval.end <= current.interval.start)
      .sort((a, b) => (b.interval.end ?? '').localeCompare(a.interval.end ?? ''))[0];
    const end = current.interval.end;
    const after =
      end === null
        ? undefined
        : here
            .filter((e) => e.interval.start >= end && e.interval.start > week)
            .sort((a, b) => a.interval.start.localeCompare(b.interval.start))[0];
    if (before && !found.has(before.planting.id)) {
      found.set(before.planting.id, {
        planting: before.planting,
        plant: before.plant,
        relation: 'before',
      });
    }
    if (after && !found.has(after.planting.id)) {
      found.set(after.planting.id, {
        planting: after.planting,
        plant: after.plant,
        relation: 'after',
      });
    }
  }
  return [...found.values()];
}

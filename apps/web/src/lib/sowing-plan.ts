import {
  isWeekInWindow,
  MAX_SOWING_COUNT,
  type Bed,
  type Plant,
  type Planting,
  type SowingBatch,
  type SowingBatchFields,
  type SowingWithPlantings,
} from '@hochbeet/contracts';
import { plantCount, weekStart } from '@hochbeet/garden-rules';
import { addWeeks, formatISO, getISOWeek, parseISO } from 'date-fns';
import type { ApiFetch } from './api';
import { toFields } from './garden';

/** Extra seeds for germination losses: +30 %. */
export const DEFAULT_RESERVE = 0.3;

/** One line of the plan: one plant sown in one week for one or more plantings. */
export interface SowingPlanRow {
  /** Plant and sowing week, stable while the plan is open. */
  key: string;
  plant: Plant;
  /** Monday of the week to sow. */
  sowDate: string;
  /** Monday of the earliest planting week. */
  transplantDate: string;
  /** Plants of all plantings of the row. */
  needed: number;
  /** Needed plus the reserve, rounded up, at least one more. */
  withReserve: number;
  /** Raising should have started before this week: buy seedlings instead? */
  tooLate: boolean;
  plantings: Planting[];
  /** Beds of the plantings, in the order of the bed list. */
  beds: Bed[];
}

const isoDate = (date: Date) => formatISO(date, { representation: 'date' });
const minusWeeks = (monday: string, weeks: number) => isoDate(addWeeks(parseISO(monday), -weeks));

/** Needed plus the reserve, rounded up, at least one extra, at most what a batch holds. */
export function withReserve(needed: number, reserve: number = DEFAULT_RESERVE): number {
  // Rounded first, so that 10 × 1.3 is 13 and not 14 because of floating point.
  const raw = Math.ceil(Math.round(needed * (1 + reserve) * 1e6) / 1e6);
  return Math.min(MAX_SOWING_COUNT, Math.max(needed + 1, raw));
}

/**
 * When to sow for a planting in `startDate`: the longest raising time before, moved later
 * (down to the shortest raising time) into the plant's raising window if possible. Weeks
 * already past are skipped; when every possible week is past, it is too late to raise the
 * plant, and the plan sows this week.
 */
export function sowWeekFor(
  plant: Pick<Plant, 'sowing'>,
  startDate: string,
  thisWeek: string,
): { sowDate: string; tooLate: boolean } | undefined {
  const raising = plant.sowing?.propagationWeeks;
  if (!raising) return undefined;
  const window = plant.sowing?.presowWeeks;
  const candidates: string[] = [];
  for (let weeks = raising.max; weeks >= raising.min; weeks--) {
    const date = minusWeeks(startDate, weeks);
    if (date >= thisWeek) candidates.push(date);
  }
  const inWindow = candidates.find(
    (date) => !window || isWeekInWindow(getISOWeek(parseISO(date)), window),
  );
  const sowDate = inWindow ?? candidates[0];
  return sowDate ? { sowDate, tooLate: false } : { sowDate: thisWeek, tooLate: true };
}

/**
 * The raising plan from the beds: for planted out plantings from this week on that have no
 * batch yet (or one that was deleted) and whose plant can be raised indoors, what to sow in
 * which week and how many. One row per plant and sowing week, by sowing week and name.
 */
export function buildSowingPlan(
  beds: readonly Bed[],
  plantings: readonly Planting[],
  plants: readonly Plant[],
  sowings: readonly SowingWithPlantings[],
  { today, reserve = DEFAULT_RESERVE }: { today: Date; reserve?: number },
): SowingPlanRow[] {
  const thisWeek = weekStart(today);
  const batchIds = new Set(sowings.map((s) => s.sowing.id));
  const rows = new Map<string, SowingPlanRow>();
  for (const planting of plantings) {
    if (planting.origin === 'DIRECT_SOW' || planting.startDate < thisWeek) continue;
    if (planting.sowingId !== undefined && batchIds.has(planting.sowingId)) continue;
    // Removed in its first week: never in the bed.
    if (planting.removedDate !== null && planting.removedDate <= planting.startDate) continue;
    const plant = plants.find((p) => p.id === planting.plantId);
    if (!plant || (plant.sowing?.method !== 'PRESOW' && plant.sowing?.method !== 'BOTH')) {
      continue;
    }
    const week = sowWeekFor(plant, planting.startDate, thisWeek);
    if (!week) continue;
    const key = `${plant.id}:${week.sowDate}`;
    const row = rows.get(key) ?? {
      key,
      plant,
      sowDate: week.sowDate,
      transplantDate: planting.startDate,
      needed: 0,
      withReserve: 0,
      tooLate: week.tooLate,
      plantings: [],
      beds: [],
    };
    row.needed += plantCount(planting, plant);
    row.plantings.push(planting);
    if (planting.startDate < row.transplantDate) row.transplantDate = planting.startDate;
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((row) => {
      const bedIds = new Set(row.plantings.map((p) => p.bedId));
      return {
        ...row,
        withReserve: withReserve(row.needed, reserve),
        beds: beds.filter((bed) => bedIds.has(bed.id)),
      };
    })
    .sort(
      (a, b) =>
        a.sowDate.localeCompare(b.sowDate) || a.plant.name.localeCompare(b.plant.name, 'de'),
    );
}

/** The batch „Chargen anlegen“ saves for a row: planned, with the seeds to sow. */
export function batchFor(row: SowingPlanRow, count: number): SowingBatchFields {
  return {
    plantId: row.plant.id,
    sowDate: row.sowDate,
    sownCount: count,
    aliveCount: 0,
    stage: 'PLANNED',
    // Too late rows are sown this week; a planting in the same week has no later date.
    ...(row.transplantDate > row.sowDate ? { plannedTransplantDate: row.transplantDate } : {}),
  };
}

/**
 * Saves the chosen rows: one planned batch per row, then the batch's id on each of its
 * plantings. `created` maps row keys to batches saved by an earlier attempt and is filled in
 * here, so a retry after a partial failure links the remaining plantings to the same batch
 * instead of creating another one. Returns the rows that failed with their errors.
 */
export async function saveSowingPlan(
  api: ApiFetch,
  rows: readonly { row: SowingPlanRow; count: number }[],
  created: Map<string, string>,
): Promise<Map<string, unknown>> {
  const failed = new Map<string, unknown>();
  await Promise.all(
    rows.map(async ({ row, count }) => {
      try {
        let sowingId = created.get(row.key);
        if (sowingId === undefined) {
          const batch = await api<SowingBatch>('/api/garden/sowings', {
            method: 'POST',
            body: JSON.stringify(batchFor(row, count)),
          });
          sowingId = batch.id;
          created.set(row.key, sowingId);
        }
        const id = sowingId;
        const results = await Promise.allSettled(
          row.plantings.map((planting) =>
            api<Planting>(`/api/garden/beds/${planting.bedId}/plantings/${planting.id}`, {
              method: 'PUT',
              body: JSON.stringify({ ...toFields(planting), sowingId: id }),
            }),
          ),
        );
        const error = results.find((r) => r.status === 'rejected');
        if (error) failed.set(row.key, error.reason);
      } catch (error) {
        failed.set(row.key, error);
      }
    }),
  );
  return failed;
}

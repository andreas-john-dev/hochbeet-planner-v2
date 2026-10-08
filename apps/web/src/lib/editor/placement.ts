import type { Bed, Direction, Plant, Planting } from '@hochbeet/contracts';
import { lifecycleEnd, weekStart } from '@hochbeet/garden-rules';
import type { Point } from './viewport';

export type PlantingKind = Planting['kind'];

/** Grid of all positions and lengths in cm. */
export const GRID_CM = 5;

/** Length of a new row before the user drags its handle. */
export const DEFAULT_ROW_LENGTH_CM = 50;

/** Hold time on a touch screen before a planting follows the finger instead of panning. */
export const LONG_PRESS_MS = 200;

/** Prefix of ids that only exist in the cache until the server has answered. */
export const TEMP_ID_PREFIX = 'tmp-';

export const isTempId = (id: string) => id.startsWith(TEMP_ID_PREFIX);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const snap = (cm: number) => Math.round(cm / GRID_CM) * GRID_CM;

/** Snaps a point to the 5 cm grid and keeps it inside the bed. */
export function snapToBed(point: Point, bed: Pick<Bed, 'widthCm' | 'depthCm'>): Point {
  return {
    x: clamp(snap(point.x), 0, bed.widthCm),
    y: clamp(snap(point.y), 0, bed.depthCm),
  };
}

/** Room from `at` to the bed edge in the row direction, in whole grid steps. */
function roomToEdge(bed: Pick<Bed, 'widthCm' | 'depthCm'>, at: Point, orientation: Direction) {
  return orientation === 'H' ? bed.widthCm - at.x : bed.depthCm - at.y;
}

/** A new row runs to the bed edge, at most 50 cm and at least one grid step. */
export function defaultRowLength(
  bed: Pick<Bed, 'widthCm' | 'depthCm'>,
  at: Point,
  orientation: Direction,
): number {
  return clamp(snap(roomToEdge(bed, at, orientation)), GRID_CM, DEFAULT_ROW_LENGTH_CM);
}

/** Row length for a handle dragged to `to`: along the row, snapped, at least 5 cm. */
export function rowLengthTo(row: { x: number; y: number; orientation: Direction }, to: Point) {
  const along = row.orientation === 'H' ? to.x - row.x : to.y - row.y;
  return Math.max(GRID_CM, snap(along));
}

/**
 * A new planting at `at` with a temporary id. It starts on the Monday of the week of
 * `today` and ends after the plant's lifecycle; rows follow the bed's main row direction.
 */
export function newPlanting({
  bed,
  plant,
  kind,
  at,
  today,
  id = `${TEMP_ID_PREFIX}${crypto.randomUUID()}`,
}: {
  bed: Bed;
  plant: Plant;
  kind: PlantingKind;
  at: Point;
  today: Date;
  id?: string;
}): Planting {
  const startDate = weekStart(today);
  const base = {
    id,
    bedId: bed.id,
    plantId: plant.id,
    x: at.x,
    y: at.y,
    startDate,
    endDate: lifecycleEnd(startDate, plant.lifecycle),
    removedDate: null,
  };
  if (kind === 'SINGLE') return { ...base, kind };
  const orientation = bed.mainRowDirection;
  return { ...base, kind, orientation, lengthCm: defaultRowLength(bed, at, orientation) };
}

const STEPS: Readonly<Record<string, Point>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/**
 * Moves the keyboard cursor for an arrow key: 5 cm, with Shift 25 cm, never out of the bed.
 * Returns null for other keys.
 */
export function moveByKey(
  at: Point,
  key: string,
  shiftKey: boolean,
  bed: Pick<Bed, 'widthCm' | 'depthCm'>,
): Point | null {
  const step = STEPS[key];
  if (!step) return null;
  const distance = shiftKey ? 5 * GRID_CM : GRID_CM;
  return snapToBed({ x: at.x + step.x * distance, y: at.y + step.y * distance }, bed);
}

/** Where the keyboard cursor starts: the bed centre on the grid. */
export const bedCentre = (bed: Pick<Bed, 'widthCm' | 'depthCm'>): Point =>
  snapToBed({ x: bed.widthCm / 2, y: bed.depthCm / 2 }, bed);

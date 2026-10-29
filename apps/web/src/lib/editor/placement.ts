import type { Bed, Direction, Plant, Planting, SowingBatch } from '@hochbeet/contracts';
import { defaultOrigin, plannedEnd, rowPlantCount, weekStart } from '@hochbeet/garden-rules';
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
 * `today`, is direct sown for direct sown plants (else planted out) and ends after the
 * plant's lifecycle; rows follow the bed's main row direction.
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
  const origin = defaultOrigin(plant);
  const base = {
    id,
    bedId: bed.id,
    plantId: plant.id,
    origin,
    x: at.x,
    y: at.y,
    startDate,
    endDate: plannedEnd({ startDate, origin }, plant),
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

/**
 * Shortest row on the 5 cm grid that holds `count` plants (`floor(length / spacing) + 1`).
 * Where no grid length holds exactly that many (spacing under 5 cm), the longest row with
 * fewer plants; never less than one grid step.
 */
export function rowLengthFor(count: number, spacingInRowCm: number): number {
  let best = GRID_CM;
  for (let length = GRID_CM; rowPlantCount(length, spacingInRowCm) <= count; length += GRID_CM) {
    best = length;
    if (rowPlantCount(length, spacingInRowCm) === count) return length;
  }
  return best;
}

/** A spacing on the grid that is at least `cm`, so neighbours never come closer. */
const gridSpacing = (cm: number) => Math.max(GRID_CM, Math.ceil(cm / GRID_CM) * GRID_CM);

/**
 * Positions of `count` single plants from `at` along the bed's main row direction, one
 * spacing in the row apart (rounded up to the grid). A row that would leave the bed
 * continues one row spacing further, again from the start.
 */
export function singlePositions(
  bed: Pick<Bed, 'widthCm' | 'depthCm' | 'mainRowDirection'>,
  plant: Pick<Plant, 'spacingInRowCm' | 'rowSpacingCm'>,
  at: Point,
  count: number,
): Point[] {
  const along = gridSpacing(plant.spacingInRowCm);
  const across = gridSpacing(plant.rowSpacingCm);
  const horizontal = bed.mainRowDirection === 'H';
  const start = horizontal ? at.x : at.y;
  const room = (horizontal ? bed.widthCm : bed.depthCm) - start;
  const perRow = Math.max(1, Math.floor(room / along) + 1);
  return Array.from({ length: count }, (_, i) => {
    const offset = (i % perRow) * along;
    const row = Math.floor(i / perRow) * across;
    return horizontal ? { x: at.x + offset, y: at.y + row } : { x: at.x + row, y: at.y + offset };
  });
}

/**
 * Plantings of `count` seedlings from a sowing batch at `at`: one row of the right length or
 * single plants, planted out in the week shown, all pointing to the batch.
 */
export function sowingPlantings({
  bed,
  plant,
  sowing,
  kind,
  count,
  at,
  week,
  newId = () => `${TEMP_ID_PREFIX}${crypto.randomUUID()}`,
}: {
  bed: Bed;
  plant: Plant;
  sowing: Pick<SowingBatch, 'id'>;
  kind: PlantingKind;
  count: number;
  at: Point;
  week: Date;
  newId?: () => string;
}): Planting[] {
  const startDate = weekStart(week);
  const base = {
    bedId: bed.id,
    plantId: plant.id,
    origin: 'TRANSPLANT' as const,
    sowingId: sowing.id,
    startDate,
    endDate: plannedEnd({ startDate, origin: 'TRANSPLANT' }, plant),
    removedDate: null,
  };
  if (kind === 'ROW') {
    return [
      {
        ...base,
        id: newId(),
        kind,
        x: at.x,
        y: at.y,
        orientation: bed.mainRowDirection,
        lengthCm: rowLengthFor(count, plant.spacingInRowCm),
      },
    ];
  }
  return singlePositions(bed, plant, at, count).map((point) => ({
    ...base,
    id: newId(),
    kind,
    ...point,
  }));
}

import type { Bed, Direction, Plant, Planting } from '@hochbeet/contracts';
import { GRID_CM as CONTRACT_GRID_CM } from '@hochbeet/contracts';

// Local copy: module re-exports are read through getters, which is measurable in hot loops.
const GRID_CM = CONTRACT_GRID_CM;

/** Footprint of a single plant: circle around its position. All values in cm. */
export interface CircleFootprint {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
}

/** Footprint of a row: axis-aligned strip, `x0 < x1`, `y0 < y1`. All values in cm. */
export interface StripFootprint {
  kind: 'strip';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Footprint = CircleFootprint | StripFootprint;

type PlantSpacing = Pick<Plant, 'spacingInRowCm' | 'rowSpacingCm'>;

/**
 * Area a planting occupies (docs/architecture.md, "Standfläche"):
 * - single plant: circle with radius spacingInRowCm / 2,
 * - row: strip of width rowSpacingCm along the row, overhanging spacingInRowCm / 2 at both ends.
 */
export function footprint(planting: Planting, plant: PlantSpacing): Footprint {
  const half = plant.spacingInRowCm / 2;
  if (planting.kind === 'SINGLE') {
    return { kind: 'circle', cx: planting.x, cy: planting.y, r: half };
  }
  const across = plant.rowSpacingCm / 2;
  const { x, y, lengthCm } = planting;
  return planting.orientation === 'H'
    ? { kind: 'strip', x0: x - half, x1: x + lengthCm + half, y0: y - across, y1: y + across }
    : { kind: 'strip', x0: x - across, x1: x + across, y0: y - half, y1: y + lengthCm + half };
}

/** Axis-aligned bounding box of a footprint. */
export function bounds(fp: Footprint): Omit<StripFootprint, 'kind'> {
  return fp.kind === 'strip'
    ? { x0: fp.x0, y0: fp.y0, x1: fp.x1, y1: fp.y1 }
    : { x0: fp.cx - fp.r, y0: fp.cy - fp.r, x1: fp.cx + fp.r, y1: fp.cy + fp.r };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function stripGap(a: StripFootprint, b: StripFootprint): number {
  const dx = Math.max(b.x0 - a.x1, a.x0 - b.x1);
  const dy = Math.max(b.y0 - a.y1, a.y0 - b.y1);
  // Apart on both axes: distance between the nearest corners.
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy);
  // Apart on one axis (or touching/overlapping on both): the larger value; negative = overlap depth.
  return Math.max(dx, dy);
}

function circleStripGap(c: CircleFootprint, s: StripFootprint): number {
  const px = clamp(c.cx, s.x0, s.x1);
  const py = clamp(c.cy, s.y0, s.y1);
  const distance = Math.hypot(c.cx - px, c.cy - py);
  if (distance > 0) return distance - c.r;
  // Centre inside the strip: overlap is the radius plus the distance to the nearest edge.
  const toEdge = Math.min(c.cx - s.x0, s.x1 - c.cx, c.cy - s.y0, s.y1 - c.cy);
  return -(toEdge + c.r);
}

/**
 * Gap in cm between two footprints: the shortest distance between their areas.
 * 0 when they touch; negative when they overlap (the more negative, the deeper).
 * Symmetric: gap(a, b) === gap(b, a).
 */
export function gap(a: Footprint, b: Footprint): number {
  if (a.kind === 'circle' && b.kind === 'circle') {
    return Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.r - b.r;
  }
  if (a.kind === 'circle' && b.kind === 'strip') return circleStripGap(a, b);
  if (a.kind === 'strip' && b.kind === 'circle') return circleStripGap(b, a);
  return stripGap(a as StripFootprint, b as StripFootprint);
}

/** 5 cm grid cell; covers [col * 5, col * 5 + 5) × [row * 5, row * 5 + 5) in cm. */
export interface GridCell {
  col: number;
  row: number;
}

export const cellKey = (cell: GridCell) => `${String(cell.col)}:${String(cell.row)}`;

/**
 * Grid cells whose area overlaps the footprint (touching edges do not count).
 * Basis of the crop rotation check, which compares predecessors per cell.
 */
export function gridCells(fp: Footprint): GridCell[] {
  const cells: GridCell[] = [];
  forEachGridCell(fp, (col, row) => cells.push({ col, row }));
  return cells;
}

/**
 * Numeric key of a cell, cheaper than `cellKey` for large indexes. Stays a small integer
 * (below 2^22), which V8 hashes fast; valid for |col|, |row| < 1024, i.e. ±51 m.
 */
export const cellIndex = (col: number, row: number) => (col + 1024) * 2048 + (row + 1024);

/** Calls `visit` for every cell `gridCells` would return, without allocating cell objects. */
export function forEachGridCell(fp: Footprint, visit: (col: number, row: number) => void) {
  const box = bounds(fp);
  const firstCol = Math.floor(box.x0 / GRID_CM);
  const firstRow = Math.floor(box.y0 / GRID_CM);
  for (let col = firstCol; col * GRID_CM < box.x1; col++) {
    for (let row = firstRow; row * GRID_CM < box.y1; row++) {
      // Touching a cell's edge does not count; the areas must overlap.
      if (fp.kind === 'strip' ? stripCoversCell(fp, col, row) : circleCoversCell(fp, col, row)) {
        visit(col, row);
      }
    }
  }
}

function stripCoversCell(s: StripFootprint, col: number, row: number): boolean {
  const x0 = col * GRID_CM;
  const y0 = row * GRID_CM;
  return s.x0 < x0 + GRID_CM && s.x1 > x0 && s.y0 < y0 + GRID_CM && s.y1 > y0;
}

function circleCoversCell(c: CircleFootprint, col: number, row: number): boolean {
  const x0 = col * GRID_CM;
  const y0 = row * GRID_CM;
  const dx = c.cx - clamp(c.cx, x0, x0 + GRID_CM);
  const dy = c.cy - clamp(c.cy, y0, y0 + GRID_CM);
  return dx * dx + dy * dy < c.r * c.r;
}

/** Row direction of a planting: its orientation for rows, the bed's main direction otherwise. */
export function rowDirection(planting: Planting, bed: Pick<Bed, 'mainRowDirection'>): Direction {
  return planting.kind === 'ROW' ? planting.orientation : bed.mainRowDirection;
}

/**
 * Default main row direction of a bed: parallel to the shorter edge, i.e. rows run across
 * the bed (1 m long rows in a 2 × 1 m bed). Width runs along x, depth along y.
 */
export function defaultMainRowDirection(bed: Pick<Bed, 'widthCm' | 'depthCm'>): Direction {
  return bed.widthCm >= bed.depthCm ? 'V' : 'H';
}

/** Number of plants in a row: floor(lengthCm / spacingInRowCm) + 1. */
export function rowPlantCount(lengthCm: number, spacingInRowCm: number): number {
  return Math.floor(lengthCm / spacingInRowCm) + 1;
}

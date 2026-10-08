import type { Bed, Plant, RowPlanting } from '@hochbeet/contracts';
import { useRef } from 'react';
import { GRID_CM, rowLengthTo } from '@/lib/editor/placement';
import type { Point } from '@/lib/editor/viewport';

const KEY_DIRECTION: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

/**
 * Grip at the end of a row: drag it along the row or use the arrow keys to change the
 * length in 5 cm steps (with Shift 25 cm). Shown as a slider to assistive technology.
 */
export function RowHandle({
  row,
  plant,
  bed,
  scale,
  toCm,
  onDraft,
  onCommit,
}: {
  row: RowPlanting;
  plant: Plant;
  bed: Bed;
  /** px per cm, to keep the grip the same size on screen at every zoom level. */
  scale: number;
  toCm: (clientX: number, clientY: number) => Point;
  /** Length while dragging; null when the drag ends. */
  onDraft: (lengthCm: number | null) => void;
  onCommit: (lengthCm: number) => void;
}) {
  // Length at the start of a drag and the current one; `row` already shows the draft.
  const dragged = useRef<{ from: number; to: number } | null>(null);
  const horizontal = row.orientation === 'H';
  const end = horizontal
    ? { x: row.x + row.lengthCm, y: row.y }
    : { x: row.x, y: row.y + row.lengthCm };
  const max = Math.max(GRID_CM, horizontal ? bed.widthCm - row.x : bed.depthCm - row.y);

  const onPointerDown = (event: React.PointerEvent<SVGGElement>) => {
    // Keep the canvas from panning.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragged.current = { from: row.lengthCm, to: row.lengthCm };
  };

  const onPointerMove = (event: React.PointerEvent<SVGGElement>) => {
    if (dragged.current === null) return;
    event.stopPropagation();
    const to = rowLengthTo(row, toCm(event.clientX, event.clientY));
    dragged.current = { ...dragged.current, to };
    onDraft(to);
  };

  const onPointerUp = (event: React.PointerEvent<SVGGElement>) => {
    if (dragged.current === null) return;
    event.stopPropagation();
    const { from, to } = dragged.current;
    dragged.current = null;
    if (to !== from) onCommit(to);
    onDraft(null);
  };

  const onKeyDown = (event: React.KeyboardEvent<SVGGElement>) => {
    const direction = KEY_DIRECTION[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const step = (event.shiftKey ? 5 : 1) * GRID_CM;
    const length = Math.max(GRID_CM, row.lengthCm + direction * step);
    if (length !== row.lengthCm) onCommit(length);
  };

  const r = 8 / scale;
  return (
    <g
      role="slider"
      tabIndex={0}
      aria-label={`Länge der Reihe ${plant.name}`}
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
      aria-valuemin={GRID_CM}
      aria-valuemax={max}
      aria-valuenow={row.lengthCm}
      aria-valuetext={`${String(row.lengthCm)} cm`}
      data-testid="row-handle"
      className={`outline-none ${horizontal ? 'cursor-ew-resize' : 'cursor-ns-resize'} [&:focus-visible>circle:last-child]:stroke-[var(--ring)]`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      {/* Invisible 44 px touch target. */}
      <circle cx={end.x} cy={end.y} r={22 / scale} fill="transparent" />
      <circle
        cx={end.x}
        cy={end.y}
        r={r}
        fill="var(--background)"
        stroke="var(--primary)"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

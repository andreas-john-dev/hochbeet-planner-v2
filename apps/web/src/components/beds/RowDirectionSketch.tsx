import type { Direction } from '@hochbeet/contracts';

/** Sketch of a bed with three rows in the given direction; explains the row direction option. */
export function RowDirectionSketch({
  widthCm,
  depthCm,
  direction,
}: {
  widthCm: number;
  depthCm: number;
  direction: Direction;
}) {
  // Keep the sketch readable for extreme or missing sizes.
  const ratio = Math.min(Math.max((widthCm || 1) / (depthCm || 1), 0.4), 2.5);
  const w = ratio >= 1 ? 60 : 60 * ratio;
  const h = ratio >= 1 ? 60 / ratio : 60;
  const x = (64 - w) / 2;
  const y = (64 - h) / 2;
  const rows = [1, 2, 3].map((i) =>
    direction === 'H'
      ? { x1: x + 4, x2: x + w - 4, y1: y + (h * i) / 4, y2: y + (h * i) / 4 }
      : { x1: x + (w * i) / 4, x2: x + (w * i) / 4, y1: y + 4, y2: y + h - 4 },
  );
  return (
    <svg viewBox="0 0 64 64" className="size-12 shrink-0" aria-hidden>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        className="fill-amber-900/15 stroke-amber-900/50 dark:fill-amber-200/10 dark:stroke-amber-200/40"
        strokeWidth={1.5}
      />
      {rows.map((r, i) => (
        <line
          key={i}
          {...r}
          className="stroke-primary"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="0.1 6"
        />
      ))}
    </svg>
  );
}

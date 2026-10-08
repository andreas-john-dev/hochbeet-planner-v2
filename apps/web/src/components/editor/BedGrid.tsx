import type { Bed } from '@hochbeet/contracts';
import { gridSteps } from '@/lib/editor/viewport';

/** The bed with its grid: fine 5 cm lines when zoomed in, coarser ones otherwise. */
export function BedGrid({ bed, scale }: { bed: Bed; scale: number }) {
  const { minor, major } = gridSteps(scale);
  const lines = (length: number) =>
    Array.from({ length: Math.floor(length / minor) - 1 }, (_, i) => (i + 1) * minor).filter(
      (v) => v < length,
    );
  const line = (key: string, x1: number, y1: number, x2: number, y2: number, isMajor: boolean) => (
    <line
      key={key}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      vectorEffect="non-scaling-stroke"
      strokeWidth={isMajor ? 1 : 0.5}
      className={
        isMajor
          ? 'stroke-amber-900/35 dark:stroke-amber-100/30'
          : 'stroke-amber-900/15 dark:stroke-amber-100/12'
      }
    />
  );
  return (
    <g data-testid="bed-grid" data-grid-step={minor}>
      <rect
        width={bed.widthCm}
        height={bed.depthCm}
        className="fill-amber-900/12 stroke-amber-900/50 dark:fill-amber-200/8 dark:stroke-amber-200/40"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {lines(bed.widthCm).map((x) => line(`x${String(x)}`, x, 0, x, bed.depthCm, x % major === 0))}
      {lines(bed.depthCm).map((y) => line(`y${String(y)}`, 0, y, bed.widthCm, y, y % major === 0))}
    </g>
  );
}

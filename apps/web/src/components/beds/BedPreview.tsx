import type { Bed, Plant, Planting } from '@hochbeet/contracts';
import { footprint } from '@hochbeet/garden-rules';
import { activePlantings } from '@/lib/active-plantings';

/**
 * Small, true-to-scale picture of a bed in the current week: footprints of the active
 * plantings in their plant colour. Decorative; the card names the bed and its size.
 */
export function BedPreview({
  bed,
  plantings,
  plants,
  date,
}: {
  bed: Bed;
  plantings: readonly Planting[];
  plants: readonly Plant[];
  date: Date;
}) {
  const active = activePlantings(plantings, plants, date);
  // A little room around the bed so its outline is not cut off.
  const pad = Math.max(bed.widthCm, bed.depthCm) / 50;
  return (
    <svg
      viewBox={`${String(-pad)} ${String(-pad)} ${String(bed.widthCm + 2 * pad)} ${String(bed.depthCm + 2 * pad)}`}
      className="bg-secondary/60 h-full max-h-40 w-full rounded-md"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      data-testid="bed-preview"
    >
      <defs>
        <clipPath id={`bed-${bed.id}`}>
          <rect width={bed.widthCm} height={bed.depthCm} />
        </clipPath>
      </defs>
      <rect
        width={bed.widthCm}
        height={bed.depthCm}
        rx={pad}
        className="fill-amber-900/15 stroke-amber-900/40 dark:fill-amber-200/10 dark:stroke-amber-200/30"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <g clipPath={`url(#bed-${bed.id})`}>
        {active.map(({ planting, plant }) => {
          const fp = footprint(planting, plant);
          return fp.kind === 'circle' ? (
            <circle
              key={planting.id}
              cx={fp.cx}
              cy={fp.cy}
              r={fp.r}
              fill={plant.color}
              fillOpacity={0.7}
            />
          ) : (
            <rect
              key={planting.id}
              x={fp.x0}
              y={fp.y0}
              width={fp.x1 - fp.x0}
              height={fp.y1 - fp.y0}
              rx={Math.min(fp.x1 - fp.x0, fp.y1 - fp.y0) / 2}
              fill={plant.color}
              fillOpacity={0.7}
            />
          );
        })}
      </g>
    </svg>
  );
}

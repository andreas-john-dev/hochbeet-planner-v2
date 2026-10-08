import type { Plant, Planting } from '@hochbeet/contracts';
import { footprint } from '@hochbeet/garden-rules';
import { IconSvg } from '@hochbeet/plant-icons/react';
import { resolveIconKey } from '@hochbeet/plant-icons';
import { iconSizeCm, plantPositions } from '@/lib/editor/plantings';

/**
 * A planting in the editor: half-transparent footprint in the plant colour plus the plant
 * icon at every plant position. One DOM node per planting, addressable by `data-testid`.
 */
export function PlantingShape({ planting, plant }: { planting: Planting; plant: Plant }) {
  const fp = footprint(planting, plant);
  const icon = resolveIconKey(plant);
  const size = iconSizeCm(plant);
  const positions = plantPositions(planting, plant);
  const label =
    planting.kind === 'ROW'
      ? `${plant.name}, Reihe mit ${String(positions.length)} Pflanzen`
      : plant.name;
  return (
    <g
      data-testid={`planting-${planting.id}`}
      data-plant-id={plant.id}
      role="img"
      aria-label={label}
    >
      {fp.kind === 'circle' ? (
        <circle
          cx={fp.cx}
          cy={fp.cy}
          r={fp.r}
          fill={plant.color}
          fillOpacity={0.3}
          stroke={plant.color}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <rect
          x={fp.x0}
          y={fp.y0}
          width={fp.x1 - fp.x0}
          height={fp.y1 - fp.y0}
          rx={Math.min(fp.x1 - fp.x0, fp.y1 - fp.y0) / 2}
          fill={plant.color}
          fillOpacity={0.3}
          stroke={plant.color}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {positions.map((p, i) => (
        <g key={i} transform={`translate(${String(p.x - size / 2)} ${String(p.y - size / 2)})`}>
          <IconSvg icon={icon} size={size} />
        </g>
      ))}
    </g>
  );
}

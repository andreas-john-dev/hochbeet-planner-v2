import type { Plant, Planting } from '@hochbeet/contracts';
import { footprint } from '@hochbeet/garden-rules';
import { IconSvg } from '@hochbeet/plant-icons/react';
import { resolveIconKey } from '@hochbeet/plant-icons';
import { iconSizeCm, plantPositions } from '@/lib/editor/plantings';

/**
 * A planting in the editor: half-transparent footprint in the plant colour plus the plant
 * icon at every plant position. One DOM node per planting, addressable by `data-testid`.
 */
export function PlantingShape({
  planting,
  plant,
  variant = 'planted',
  selected = false,
}: {
  planting: Planting;
  plant: Plant;
  /** `preview`: the planting about to be placed, drawn lighter and dashed. */
  variant?: 'planted' | 'preview';
  selected?: boolean;
}) {
  const fp = footprint(planting, plant);
  const icon = resolveIconKey(plant);
  const size = iconSizeCm(plant);
  const positions = plantPositions(planting, plant);
  const preview = variant === 'preview';
  const outline = {
    fill: plant.color,
    fillOpacity: 0.3,
    stroke: selected ? 'var(--primary)' : plant.color,
    strokeWidth: selected ? 2.5 : 1.5,
    strokeDasharray: preview ? '4 3' : undefined,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  const label =
    planting.kind === 'ROW'
      ? `${plant.name}, Reihe mit ${String(positions.length)} Pflanzen`
      : plant.name;
  return (
    <g
      data-testid={preview ? 'placement-preview' : `planting-${planting.id}`}
      data-plant-id={plant.id}
      data-kind={planting.kind}
      data-x={planting.x}
      data-y={planting.y}
      data-length-cm={planting.kind === 'ROW' ? planting.lengthCm : undefined}
      data-selected={selected || undefined}
      role={preview ? undefined : 'img'}
      aria-label={preview ? undefined : label}
      aria-hidden={preview || undefined}
      opacity={preview ? 0.75 : undefined}
      className={preview ? 'pointer-events-none' : undefined}
    >
      {fp.kind === 'circle' ? (
        <circle cx={fp.cx} cy={fp.cy} r={fp.r} {...outline} />
      ) : (
        <rect
          x={fp.x0}
          y={fp.y0}
          width={fp.x1 - fp.x0}
          height={fp.y1 - fp.y0}
          rx={Math.min(fp.x1 - fp.x0, fp.y1 - fp.y0) / 2}
          {...outline}
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

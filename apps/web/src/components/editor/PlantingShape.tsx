import type { Plant, Planting } from '@hochbeet/contracts';
import { bounds, footprint, type Severity } from '@hochbeet/garden-rules';
import { IconSvg } from '@hochbeet/plant-icons/react';
import { resolveIconKey } from '@hochbeet/plant-icons';
import { iconSizeCm, plantPositions } from '@/lib/editor/plantings';

const STATUS_LABEL: Record<Severity, string> = {
  WARNING: 'Warnung',
  HINT: 'Hinweis',
  POSITIVE: 'gute Nachbarn',
};

/** Colour and symbol per status; colour is never the only signal. */
const BADGE: Record<Severity, { fill: string; symbol: string }> = {
  WARNING: { fill: '#dc2626', symbol: '!' },
  HINT: { fill: '#71717a', symbol: 'i' },
  POSITIVE: { fill: '#16a34a', symbol: '✓' },
};

/** Round badge at the top right of a footprint, the same size on screen at every zoom. */
function StatusBadge({
  status,
  at,
  scale,
}: {
  status: Severity;
  at: { x1: number; y0: number };
  scale: number;
}) {
  const { fill, symbol } = BADGE[status];
  const r = 8 / scale;
  return (
    <g data-testid="status-badge" aria-hidden>
      <circle cx={at.x1} cy={at.y0} r={r} fill={fill} stroke="white" strokeWidth={1.5 / scale} />
      <text
        x={at.x1}
        y={at.y0}
        fill="white"
        fontSize={11 / scale}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {symbol}
      </text>
    </g>
  );
}

/**
 * A planting in the editor: half-transparent footprint in the plant colour plus the plant
 * icon at every plant position. One focusable DOM node per planting, addressable by
 * `data-testid`; the selected one gets a thicker outline in the primary colour.
 */
export function PlantingShape({
  planting,
  plant,
  variant = 'planted',
  selected = false,
  relation,
  status,
  highlighted = false,
  scale = 1,
  onFocus,
}: {
  planting: Planting;
  plant: Plant;
  /**
   * `preview`: the planting about to be placed, drawn lighter and dashed.
   * `ghost`: a predecessor or successor at the same place in another week, drawn faintly.
   */
  variant?: 'planted' | 'preview' | 'ghost';
  selected?: boolean;
  /** For ghosts: before or after the planting of the shown week. */
  relation?: 'before' | 'after';
  /** Most serious finding of the week: drawn as a badge with colour and symbol. */
  status?: Severity;
  /** Part of the finding picked in the list. */
  highlighted?: boolean;
  /** px per cm, so the badge keeps its size on screen. */
  scale?: number;
  onFocus?: () => void;
}) {
  const fp = footprint(planting, plant);
  const icon = resolveIconKey(plant);
  const size = iconSizeCm(plant);
  const positions = plantPositions(planting, plant);
  const preview = variant === 'preview';
  const ghost = variant === 'ghost';
  // Previews and ghosts are pictures only: not focusable, not clickable.
  const inert = preview || ghost;
  const outline = {
    fill: plant.color,
    fillOpacity: 0.3,
    stroke: highlighted
      ? '#f59e0b'
      : selected
        ? 'var(--primary)'
        : status === 'WARNING'
          ? '#dc2626'
          : plant.color,
    strokeWidth: highlighted ? 4 : selected ? 2.5 : status === 'WARNING' ? 2 : 1.5,
    strokeDasharray: preview ? '4 3' : ghost ? '2 3' : undefined,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  const label =
    planting.kind === 'ROW'
      ? `${plant.name}, Reihe mit ${String(positions.length)} Pflanzen`
      : plant.name;
  return (
    <g
      data-testid={
        preview ? 'placement-preview' : ghost ? `ghost-${planting.id}` : `planting-${planting.id}`
      }
      data-planting-id={inert ? undefined : planting.id}
      data-ghost={relation}
      data-status={status?.toLowerCase()}
      data-highlighted={highlighted || undefined}
      data-plant-id={plant.id}
      data-kind={planting.kind}
      data-x={planting.x}
      data-y={planting.y}
      data-length-cm={planting.kind === 'ROW' ? planting.lengthCm : undefined}
      data-selected={selected || undefined}
      role={inert ? undefined : 'button'}
      tabIndex={inert ? undefined : 0}
      aria-label={inert ? undefined : status ? `${label} (${STATUS_LABEL[status]})` : label}
      aria-pressed={inert ? undefined : selected}
      aria-hidden={inert || undefined}
      opacity={preview ? 0.75 : ghost ? 0.3 : undefined}
      className={inert ? 'pointer-events-none' : 'cursor-move outline-none'}
      onFocus={onFocus}
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
      {status && <StatusBadge status={status} at={bounds(fp)} scale={scale} />}
      {positions.map((p, i) => (
        <g key={i} transform={`translate(${String(p.x - size / 2)} ${String(p.y - size / 2)})`}>
          <IconSvg icon={icon} size={size} />
        </g>
      ))}
    </g>
  );
}

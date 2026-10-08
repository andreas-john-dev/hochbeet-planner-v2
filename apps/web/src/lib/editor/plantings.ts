import type { Plant, Planting } from '@hochbeet/contracts';
import { rowPlantCount } from '@hochbeet/garden-rules';

/** Icon edge in cm: about the spacing, readable for small and not huge for large plants. */
export const iconSizeCm = (plant: Plant) => Math.min(24, Math.max(8, plant.spacingInRowCm * 0.8));

/** Centres of the plants of a planting: one for a single plant, every plant of a row. */
export function plantPositions(planting: Planting, plant: Plant): { x: number; y: number }[] {
  if (planting.kind === 'SINGLE') return [{ x: planting.x, y: planting.y }];
  const count = rowPlantCount(planting.lengthCm, plant.spacingInRowCm);
  return Array.from({ length: count }, (_, i) =>
    planting.orientation === 'H'
      ? { x: planting.x + i * plant.spacingInRowCm, y: planting.y }
      : { x: planting.x, y: planting.y + i * plant.spacingInRowCm },
  );
}

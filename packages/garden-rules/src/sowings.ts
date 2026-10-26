import type { Plant } from '@hochbeet/contracts';
import { type CountablePlanting, plantCount } from './geometry';

/**
 * Seedlings of a batch already planned into beds: the plants of all linked plantings, with
 * the spacing of the batch's (effective) plant. Undefined if that plant is unknown, because
 * rows cannot be counted without it.
 */
export function plannedCount(
  batch: { sowing: { plantId: string }; plantings: readonly CountablePlanting[] },
  plants: readonly Pick<Plant, 'id' | 'spacingInRowCm'>[],
): number | undefined {
  const plant = plants.find((p) => p.id === batch.sowing.plantId);
  if (!plant) return undefined;
  return batch.plantings.reduce((sum, planting) => sum + plantCount(planting, plant), 0);
}

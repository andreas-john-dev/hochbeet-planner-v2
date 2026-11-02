import type { Plant, SowingWithPlantings } from '@hochbeet/contracts';
import type { SowingInfo } from './context';
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

/** Batches by id with their planned seedlings, counted once for all rules. */
export function sowingInfos(
  sowings: readonly SowingWithPlantings[],
  plants: readonly Plant[],
): Map<string, SowingInfo> {
  return new Map(
    sowings.map((item) => [
      item.sowing.id,
      { sowing: item.sowing, planned: plannedCount(item, plants) },
    ]),
  );
}

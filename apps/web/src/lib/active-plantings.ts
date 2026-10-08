import type { Plant, Planting } from '@hochbeet/contracts';
import { isActiveInWeek, plantingInterval } from '@hochbeet/garden-rules';

/** Plantings that are in the bed during the week of `date`, with their plant. */
export function activePlantings(
  plantings: readonly Planting[],
  plants: readonly Plant[],
  date: Date,
) {
  const plantOf = new Map(plants.map((p) => [p.id, p]));
  return plantings.flatMap((planting) => {
    const plant = plantOf.get(planting.plantId);
    if (!plant || !isActiveInWeek(plantingInterval(planting, plant), date)) return [];
    return [{ planting, plant }];
  });
}

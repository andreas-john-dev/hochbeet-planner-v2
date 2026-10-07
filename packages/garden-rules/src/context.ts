import type { Bed, Plant, Planting } from '@hochbeet/contracts';
import { type Footprint, footprint } from './geometry';
import { type Interval, plantingInterval } from './time';

/** A planting together with everything the rules need about it. */
export interface ResolvedPlanting {
  planting: Planting;
  plant: Plant;
  footprint: Footprint;
  interval: Interval;
}

/**
 * Joins plantings with their (effective) plants and precomputes footprint and time span.
 * Plantings whose plant is unknown are skipped: without spacing and family there is nothing
 * to check.
 */
export function resolvePlantings(
  plantings: readonly Planting[],
  plants: readonly Plant[],
): ResolvedPlanting[] {
  const byId = new Map(plants.map((plant) => [plant.id, plant]));
  return plantings.flatMap((planting) => {
    const plant = byId.get(planting.plantId);
    return plant
      ? [
          {
            planting,
            plant,
            footprint: footprint(planting, plant),
            interval: plantingInterval(planting, plant),
          },
        ]
      : [];
  });
}

/** Everything a rule gets: the bed and its resolved plantings. */
export interface RuleContext {
  bed: Bed;
  plantings: readonly ResolvedPlanting[];
}

/** Calls `visit` once for every unordered pair of plantings. */
export function forEachPair(
  plantings: readonly ResolvedPlanting[],
  visit: (a: ResolvedPlanting, b: ResolvedPlanting) => void,
) {
  for (const [i, a] of plantings.entries()) {
    for (let j = i + 1; j < plantings.length; j++) {
      const b = plantings[j];
      if (b) visit(a, b);
    }
  }
}

export const sortedIds = (...items: ResolvedPlanting[]) =>
  items.map((item) => item.planting.id).sort();

import type { Bed, Plant, Planting, SowingBatch } from '@hochbeet/contracts';
import { type Footprint, footprint } from './geometry';
import type { Messages } from './messages';
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

/** A sowing batch with the seedlings planned into beds (all beds), for the rules. */
export interface SowingInfo {
  sowing: SowingBatch;
  /** Plants of all linked plantings; undefined if the batch's plant is unknown. */
  planned: number | undefined;
}

/** Everything a rule gets: the bed, its resolved plantings and the user's settings. */
export interface RuleContext {
  bed: Bed;
  plantings: readonly ResolvedPlanting[];
  /** Last frost as `MM-DD`, every year. */
  lastFrost: string;
  /** The user's sowing batches by id; empty when the caller passes none. */
  sowings: ReadonlyMap<string, SowingInfo>;
  /** Texts in the caller's language (`messagesFor()`). */
  texts: Messages;
  /** Name of a plant in the texts (`EvaluateOptions.plantName`). */
  plantName: (plant: Plant) => string;
  /** Family of a plant in the texts (`EvaluateOptions.familyName`). */
  familyName: (plant: Plant) => string;
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

/**
 * The display names of a pair in alphabetical order of the language ("Kartoffel", "Tomate"),
 * so the text does not depend on the order of the plantings.
 */
export function pairNames(
  { texts, plantName }: Pick<RuleContext, 'texts' | 'plantName'>,
  a: ResolvedPlanting,
  b: ResolvedPlanting,
): [string, string] {
  const first = plantName(a.plant);
  const second = plantName(b.plant);
  return first.localeCompare(second, texts.collation) <= 0 ? [first, second] : [second, first];
}

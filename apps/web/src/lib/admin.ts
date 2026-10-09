import type { CatalogPlant, Plant, PlantFields, PlantOverride } from '@hochbeet/contracts';
import { overrideFor } from './catalog';

const normalize = (text: string) => text.toLocaleLowerCase('de').trim();

/** Length of the longest common substring, e.g. 5 for "Eichblattsalat" and "Kopfsalat". */
function commonLength(a: string, b: string) {
  let best = 0;
  const previous = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j] ?? 0;
      previous[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : 0;
      best = Math.max(best, previous[j] ?? 0);
      diagonal = above;
    }
  }
  return best;
}

/** Names share a word or a part of at least five letters ("salat", "zucchini"). */
const namesMatch = (a: string, b: string) => commonLength(normalize(a), normalize(b)) >= 5;

/**
 * Global plants an admin should compare a request with: similar names first, then the same
 * family (same category breaks ties). Avoids publishing a plant twice under another name.
 */
export function similarPlants(plant: Plant, globals: readonly Plant[], max = 3): Plant[] {
  const score = (other: Plant) =>
    (namesMatch(plant.name, other.name) ? 4 : 0) +
    (normalize(plant.family) === normalize(other.family) ? 2 : 0) +
    (plant.category === other.category ? 1 : 0);
  return globals
    .filter((other) => other.id !== plant.id)
    .map((other) => ({ other, score: score(other) }))
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score || a.other.name.localeCompare(b.other.name, 'de'))
    .slice(0, max)
    .map(({ other }) => other);
}

/** The corrections an admin made before approving: fields that differ from the request. */
export function correctionsFor(requested: Plant, edited: PlantFields): PlantOverride | null {
  return overrideFor({ ...requested, source: 'OWN', overridden: false }, edited);
}

/** A global plant with its global values, without the admin's own adjustment. */
export function globalValues(plant: CatalogPlant): CatalogPlant {
  const { global, ...rest } = plant;
  return { ...rest, ...global, overridden: false };
}

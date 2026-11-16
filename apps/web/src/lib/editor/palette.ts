import type { Category, Plant } from '@hochbeet/contracts';
import type { Language } from '../language';
import { byPlantName, matchesPlantName } from '../plant-names';

/** Categories of the palette's filter; their names are under `editor:palette.categories`. */
export const CATEGORIES: readonly Category[] = ['GEMUESE', 'KRAUT', 'OBST'];

/**
 * Plants of the palette: matching the search (German or English name) and category, sorted by
 * their name in `language`.
 */
export function filterPlants(
  plants: readonly Plant[],
  query: string,
  category: Category | null,
  language: Language,
): Plant[] {
  return plants
    .filter((p) => (category === null || p.category === category) && matchesPlantName(p, query))
    .sort(byPlantName(language));
}

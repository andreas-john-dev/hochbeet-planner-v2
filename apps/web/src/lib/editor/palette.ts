import type { Category, Plant } from '@hochbeet/contracts';

export const CATEGORIES: readonly { value: Category; label: string }[] = [
  { value: 'GEMUESE', label: 'Gemüse' },
  { value: 'KRAUT', label: 'Kräuter' },
  { value: 'OBST', label: 'Obst' },
];

const normalize = (text: string) => text.toLocaleLowerCase('de').trim();

/** Plants of the palette: matching the search and category, sorted by name. */
export function filterPlants(
  plants: readonly Plant[],
  query: string,
  category: Category | null,
): Plant[] {
  const q = normalize(query);
  return plants
    .filter((p) => (category === null || p.category === category) && normalize(p.name).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

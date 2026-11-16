import type { GlobalPlantFields, PlantTranslation } from '@hochbeet/contracts';

/** Neighbour list of a seed entry: plant names and short forms, or "wie X". */
export type NeighborRefs = readonly string[] | { readonly like: string };

export interface SeedEntry extends Omit<
  GlobalPlantFields,
  'goodNeighbors' | 'badNeighbors' | 'translations'
> {
  id: string;
  /** English name and family; every seed plant has them. */
  translations: { en: PlantTranslation };
  good: NeighborRefs;
  bad: NeighborRefs;
}

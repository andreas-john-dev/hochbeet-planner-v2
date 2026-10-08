import type { PlantFields } from '@hochbeet/contracts';

/** Neighbour list of a seed entry: plant names and short forms, or "wie X". */
export type NeighborRefs = readonly string[] | { readonly like: string };

export interface SeedEntry extends Omit<PlantFields, 'goodNeighbors' | 'badNeighbors'> {
  id: string;
  good: NeighborRefs;
  bad: NeighborRefs;
}

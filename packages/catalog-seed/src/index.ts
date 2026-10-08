import type { Plant } from '@hochbeet/contracts';
import { seedEntries } from './data';
import { resolveSeed } from './resolve';

export { contradictionReport, findContradictions, type Contradiction } from './contradictions';
export { resolveSeed, UnknownNeighborError } from './resolve';
export type { NeighborRefs, SeedEntry } from './types';
export { seedEntries };

/** The start catalogue from docs/startkatalog.md with resolved neighbour IDs. */
export const seedPlants: readonly Plant[] = resolveSeed(seedEntries);

/** Seed plant by its German name, e.g. `seedPlantByName.get('Tomate')`. */
export const seedPlantByName: ReadonlyMap<string, Plant> = new Map(
  seedPlants.map((plant) => [plant.name, plant]),
);

import { createHash } from 'node:crypto';
import { seedPlants } from '@hochbeet/catalog-seed';
import type { Plant } from '@hochbeet/contracts';
import { GLOBAL_PK, plantSk } from '../table';

/** A global plant as stored in DynamoDB. `seedHash` marks the seed version it came from. */
export type GlobalPlantItem = Plant & { PK: string; SK: string; seedHash: string };

const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

export function seedItems(plants: readonly Plant[] = seedPlants): GlobalPlantItem[] {
  return plants.map((plant) => ({
    PK: GLOBAL_PK,
    SK: plantSk(plant.id),
    ...plant,
    seedHash: hash(plant),
  }));
}

/** Changes whenever any seed plant changes; triggers the seed custom resource on deploy. */
export function seedVersion(plants: readonly Plant[] = seedPlants): string {
  return hash(seedItems(plants).map((item) => item.seedHash));
}

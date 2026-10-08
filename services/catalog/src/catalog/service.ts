import type { CatalogPlant, PlantFields, PlantOverride } from '@hochbeet/contracts';
import { ulid } from 'ulid';
import { type Issue, NotFoundError, ValidationError } from '../errors';
import { effectiveCatalog, type OwnPlantItem } from './effective';
import type { CatalogRepository } from './repository';

export type CatalogStore = Pick<
  CatalogRepository,
  | 'listGlobalPlants'
  | 'listUserItems'
  | 'getGlobalPlant'
  | 'getOwnPlant'
  | 'createOwnPlant'
  | 'replaceOwnPlant'
  | 'archiveOwnPlant'
  | 'putOverride'
  | 'deleteOverride'
>;

const NEIGHBOR_LISTS = ['goodNeighbors', 'badNeighbors'] as const;
type Neighbors = Partial<Pick<PlantFields, (typeof NEIGHBOR_LISTS)[number]>>;

const PLANT_NOT_FOUND = 'Diese Sorte gibt es nicht.';

/** Use cases of the catalog for one user: list, own plants and personal overrides. */
export class CatalogService {
  constructor(
    private readonly store: CatalogStore,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = () => ulid(),
  ) {}

  async list(userId: string): Promise<CatalogPlant[]> {
    const [globals, { overrides, own }] = await Promise.all([
      this.store.listGlobalPlants(),
      this.store.listUserItems(userId),
    ]);
    return effectiveCatalog(globals, overrides, own);
  }

  async createOwnPlant(userId: string, fields: PlantFields): Promise<CatalogPlant> {
    const id = this.newId();
    await this.checkOwnNeighbors(userId, id, fields);
    const item: OwnPlantItem = { ...fields, id, publicationStatus: 'PRIVATE', archived: false };
    await this.store.createOwnPlant(userId, item);
    return toCatalogPlant(item);
  }

  async updateOwnPlant(userId: string, id: string, fields: PlantFields): Promise<CatalogPlant> {
    const existing = await this.store.getOwnPlant(userId, id);
    if (!existing || existing.archived) throw new NotFoundError(PLANT_NOT_FOUND);
    await this.checkOwnNeighbors(userId, id, fields);
    // Publication state is not part of the fields; it changes only through the workflow.
    const item: OwnPlantItem = { ...existing, ...fields, id };
    if (!(await this.store.replaceOwnPlant(userId, item))) throw new NotFoundError(PLANT_NOT_FOUND);
    return toCatalogPlant(item);
  }

  /**
   * Own plants are never deleted, only archived: plantings in the garden service may still
   * reference them, and the services never ask each other. Archiving twice is fine.
   */
  async archiveOwnPlant(userId: string, id: string): Promise<void> {
    const existing = await this.store.getOwnPlant(userId, id);
    if (!existing) throw new NotFoundError(PLANT_NOT_FOUND);
    if (existing.archived) return;
    await this.store.archiveOwnPlant(userId, id, this.now().toISOString());
  }

  async saveOverride(
    userId: string,
    plantId: string,
    fields: PlantOverride,
  ): Promise<CatalogPlant> {
    const global = await this.store.getGlobalPlant(plantId);
    if (!global) throw new NotFoundError(PLANT_NOT_FOUND);
    const globalIds = new Set((await this.store.listGlobalPlants()).map((p) => p.id));
    globalIds.add(plantId);
    checkNeighbors(
      fields,
      plantId,
      globalIds,
      'Globale Sorten dürfen nur auf globale Sorten verweisen.',
    );
    await this.store.putOverride(userId, plantId, fields);
    const [plant] = effectiveCatalog([global], [{ plantId, fields }], []);
    if (!plant) throw new Error('effective plant missing');
    return plant;
  }

  async resetOverride(userId: string, plantId: string): Promise<void> {
    if (!(await this.store.getGlobalPlant(plantId))) throw new NotFoundError(PLANT_NOT_FOUND);
    await this.store.deleteOverride(userId, plantId);
  }

  /** Own plants may name global plants and the user's other own, non-archived plants. */
  private async checkOwnNeighbors(userId: string, id: string, fields: Neighbors) {
    const [globals, { own }] = await Promise.all([
      this.store.listGlobalPlants(),
      this.store.listUserItems(userId),
    ]);
    const known = new Set([
      ...globals.map((p) => p.id),
      ...own.filter((p) => !p.archived).map((p) => p.id),
      id,
    ]);
    checkNeighbors(fields, id, known, 'Unbekannte Sorte.');
  }
}

function checkNeighbors(fields: Neighbors, selfId: string, known: Set<string>, unknown: string) {
  const issues: Issue[] = NEIGHBOR_LISTS.flatMap((list) =>
    (fields[list] ?? []).flatMap((neighborId, index): Issue[] => {
      const path = `${list}.${String(index)}`;
      if (neighborId === selfId)
        return [{ path, message: 'Eine Sorte kann nicht ihr eigener Nachbar sein.' }];
      return known.has(neighborId) ? [] : [{ path, message: unknown }];
    }),
  );
  if (issues.length > 0) throw new ValidationError('Bitte prüfe die Nachbarn.', issues);
}

function toCatalogPlant(item: OwnPlantItem): CatalogPlant {
  const [plant] = effectiveCatalog([], [], [item]);
  if (!plant) throw new Error('own plant missing');
  return plant;
}

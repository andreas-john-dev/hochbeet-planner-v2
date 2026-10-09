import {
  type ImportCatalogRequest,
  type ImportCatalogResponse,
  ImportCatalogResponseSchema,
  type Plant,
  type PlantFields,
} from '@hochbeet/contracts';
import type { OverrideItem, OwnPlantItem } from './effective';
import type { CatalogRepository } from './repository';

export type CatalogImportStore = Pick<
  CatalogRepository,
  'getImport' | 'putImport' | 'putImported' | 'listGlobalPlants'
>;

/**
 * The imported own plants with new ids, private, and the adjustments of known global plants.
 * Neighbours point to the new ids of imported plants or to global plants; others are dropped,
 * like adjustments of plants that are not global (any more). `known` holds ids chosen by an
 * earlier, interrupted attempt of the same import.
 */
export function planCatalogImport(
  request: ImportCatalogRequest,
  globals: readonly Plant[],
  known: Readonly<Record<string, string>>,
  newId: () => string,
): { ids: Record<string, string>; own: OwnPlantItem[]; overrides: OverrideItem[] } {
  const ids: Record<string, string> = { ...known };
  for (const plant of request.ownPlants) ids[plant.id] ??= newId();
  const globalIds = new Set(globals.map((p) => p.id));
  const neighbor = (id: string) => ids[id] ?? (globalIds.has(id) ? id : undefined);
  const mapNeighbors = (list: readonly string[], keep: (id: string) => string | undefined) =>
    list.flatMap((id) => keep(id) ?? []);

  const own = request.ownPlants.map(({ archived, ...plant }): OwnPlantItem => {
    const id = ids[plant.id] ?? newId();
    const keep = (n: string) => {
      const mapped = neighbor(n);
      return mapped === id ? undefined : mapped;
    };
    return {
      ...plant,
      id,
      goodNeighbors: mapNeighbors(plant.goodNeighbors, keep),
      badNeighbors: mapNeighbors(plant.badNeighbors, keep),
      publicationStatus: 'PRIVATE',
      archived: archived ?? false,
    };
  });

  // Adjustments of global plants may only name global neighbours.
  const onlyGlobal = (n: string) => (globalIds.has(n) ? n : undefined);
  const overrides = request.overrides.flatMap(({ plantId, fields }): OverrideItem[] => {
    if (!globalIds.has(plantId)) return [];
    const mapped: Partial<PlantFields> = { ...fields };
    if (fields.goodNeighbors) mapped.goodNeighbors = mapNeighbors(fields.goodNeighbors, onlyGlobal);
    if (fields.badNeighbors) mapped.badNeighbors = mapNeighbors(fields.badNeighbors, onlyGlobal);
    return [{ plantId, fields: mapped }];
  });

  return { ids, own, overrides };
}

/**
 * Imports a guest's own plants and adjustments into the user's catalogue. Like the garden
 * import, the id mapping is stored first and the response last, so a repeated call with the
 * same `importId` returns the stored response or finishes with the same ids.
 */
export async function importCatalog(
  store: CatalogImportStore,
  userId: string,
  request: ImportCatalogRequest,
  newId: () => string,
): Promise<ImportCatalogResponse> {
  const existing = await store.getImport(userId, request.importId);
  const done = ImportCatalogResponseSchema.safeParse(existing?.result);
  if (done.success) return done.data;

  const globals = await store.listGlobalPlants();
  const { ids, own, overrides } = planCatalogImport(request, globals, existing?.ids ?? {}, newId);
  await store.putImport(userId, request.importId, { ids });
  await store.putImported(userId, own, overrides);
  const result: ImportCatalogResponse = {
    plantIds: Object.fromEntries(request.ownPlants.map((p) => [p.id, ids[p.id] ?? ''])),
  };
  await store.putImport(userId, request.importId, { ids, result });
  return result;
}

import {
  type Bed,
  type ImportGardenRequest,
  type ImportGardenResponse,
  ImportGardenResponseSchema,
  type Planting,
} from '@hochbeet/contracts';
import type { GardenRepository } from './repository';

export type ImportStore = Pick<GardenRepository, 'getImport' | 'putImport' | 'putImported'>;

/**
 * The imported beds and plantings with new ids. `known` holds ids already chosen by an
 * earlier, interrupted attempt of the same import; they are kept so nothing is written twice.
 */
export function planGardenImport(
  request: ImportGardenRequest,
  known: Readonly<Record<string, string>>,
  newId: () => string,
): { ids: Record<string, string>; beds: Bed[]; plantings: Planting[] } {
  const ids: Record<string, string> = { ...known };
  const idFor = (oldId: string) => (ids[oldId] ??= newId());
  const beds = request.beds.map((bed) => ({ ...bed, id: idFor(bed.id) }));
  const plantings = request.plantings.map((planting) => ({
    ...planting,
    id: idFor(`planting:${planting.id}`),
    bedId: idFor(planting.bedId),
  }));
  return { ids, beds, plantings };
}

/**
 * Imports a guest's beds and plantings into the user's garden. The id mapping is stored
 * before anything else, the response only at the end: a repeated call with the same
 * `importId` returns the stored response, or finishes an interrupted import with the same ids.
 */
export async function importGarden(
  store: ImportStore,
  userId: string,
  request: ImportGardenRequest,
  newId: () => string,
): Promise<ImportGardenResponse> {
  const existing = await store.getImport(userId, request.importId);
  const done = ImportGardenResponseSchema.safeParse(existing?.result);
  if (done.success) return done.data;

  const { ids, beds, plantings } = planGardenImport(request, existing?.ids ?? {}, newId);
  await store.putImport(userId, request.importId, { ids });
  await store.putImported(userId, beds, plantings);
  const result: ImportGardenResponse = {
    bedIds: Object.fromEntries(request.beds.map((bed) => [bed.id, ids[bed.id] ?? ''])),
  };
  await store.putImport(userId, request.importId, { ids, result });
  return result;
}

import {
  type ImportGardenRequest,
  type ImportGardenResponse,
  ImportGardenResponseSchema,
  type Planting,
} from '@hochbeet/contracts';
import type { GardenRepository, ImportedGarden } from './repository';

export type ImportStore = Pick<GardenRepository, 'getImport' | 'putImport' | 'putImported'>;

/**
 * The imported beds, plantings and sowing batches with new ids. `known` holds ids already
 * chosen by an earlier, interrupted attempt of the same import; they are kept so nothing is
 * written twice. Plantings point to the new beds and batches; a `sowingId` of a batch outside
 * the import pointed to nothing in the browser either and is dropped.
 */
export function planGardenImport(
  request: ImportGardenRequest,
  known: Readonly<Record<string, string>>,
  newId: () => string,
): ImportedGarden & { ids: Record<string, string> } {
  const ids: Record<string, string> = { ...known };
  const idFor = (oldId: string) => (ids[oldId] ??= newId());
  const beds = request.beds.map((bed) => ({ ...bed, id: idFor(bed.id) }));
  const sowings = request.sowings.map((sowing) => ({
    ...sowing,
    id: idFor(`sowing:${sowing.id}`),
  }));
  const importedSowings = new Set(request.sowings.map((sowing) => sowing.id));
  const plantings = request.plantings.map(({ sowingId, ...planting }): Planting => ({
    ...planting,
    id: idFor(`planting:${planting.id}`),
    bedId: idFor(planting.bedId),
    ...(sowingId !== undefined && importedSowings.has(sowingId)
      ? { sowingId: idFor(`sowing:${sowingId}`) }
      : {}),
  }));
  return { ids, beds, plantings, sowings };
}

/**
 * Imports a guest's beds, plantings and sowing batches into the user's garden. The id mapping is stored
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

  const { ids, ...garden } = planGardenImport(request, existing?.ids ?? {}, newId);
  await store.putImport(userId, request.importId, { ids });
  await store.putImported(userId, garden);
  const result: ImportGardenResponse = {
    bedIds: Object.fromEntries(request.beds.map((bed) => [bed.id, ids[bed.id] ?? ''])),
  };
  await store.putImport(userId, request.importId, { ids, result });
  return result;
}

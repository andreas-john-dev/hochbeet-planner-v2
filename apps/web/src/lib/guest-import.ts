import {
  type ImportCatalogRequest,
  type ImportCatalogResponse,
  type ImportGardenRequest,
  type ImportGardenResponse,
  PlantSchema,
} from '@hochbeet/contracts';
import { ulid } from 'ulid';
import type { ApiFetch } from './api';
import { GUEST_IMPORT_ID_KEY } from './local-api/keys';
import type { LocalGarden } from './local-api/store';

/** What the guest left in this browser, for the question after sign-in. */
export function guestDataSummary(garden: LocalGarden) {
  return {
    beds: garden.beds.length,
    plantings: garden.plantings.length,
    ownPlants: (garden.ownPlants ?? []).filter((p) => !p.archived).length,
    overrides: Object.keys(garden.overrides ?? {}).length,
  };
}

export function hasGuestData(garden: LocalGarden): boolean {
  const { beds, ownPlants, overrides } = guestDataSummary(garden);
  return beds + ownPlants + overrides > 0;
}

/** „2 Beete, 5 Pflanzungen und 1 eigene Sorte“ */
export function describeGuestData(garden: LocalGarden): string {
  const { beds, plantings, ownPlants, overrides } = guestDataSummary(garden);
  const parts = [
    [beds, 'Beet', 'Beete'],
    [plantings, 'Pflanzung', 'Pflanzungen'],
    [ownPlants, 'eigene Sorte', 'eigene Sorten'],
    [overrides, 'Anpassung', 'Anpassungen'],
  ] as const;
  const named = parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${String(n)} ${n === 1 ? one : many}`);
  return named.length > 1
    ? `${named.slice(0, -1).join(', ')} und ${named.at(-1) ?? ''}`
    : (named[0] ?? '');
}

/** Own plants (archived ones too: plantings may use them) and adjustments. */
export function catalogImportRequest(garden: LocalGarden, importId: string): ImportCatalogRequest {
  return {
    importId,
    ownPlants: (garden.ownPlants ?? []).map((plant) => ({
      ...PlantSchema.parse(plant),
      ...(plant.archived ? { archived: true } : {}),
    })),
    overrides: Object.entries(garden.overrides ?? {}).map(([plantId, fields]) => ({
      plantId,
      fields,
    })),
  };
}

/** Beds and plantings, with plantings pointing to the new ids of imported own plants. */
export function gardenImportRequest(
  garden: LocalGarden,
  importId: string,
  plantIds: Readonly<Record<string, string>>,
): ImportGardenRequest {
  return {
    importId,
    beds: garden.beds,
    plantings: garden.plantings.map((p) => ({ ...p, plantId: plantIds[p.plantId] ?? p.plantId })),
  };
}

/**
 * The import id stays the same until the import succeeded, so retrying after an error
 * never imports anything twice (both services are idempotent per id).
 */
export function guestImportId(storage: Storage = localStorage): string {
  const existing = storage.getItem(GUEST_IMPORT_ID_KEY);
  if (existing) return existing;
  const id = ulid();
  storage.setItem(GUEST_IMPORT_ID_KEY, id);
  return id;
}

/**
 * Moves the guest's data into the signed-in user's account: catalogue first, because the
 * plantings need the new ids of own plants, then beds and plantings.
 */
export async function importGuestData(api: ApiFetch, garden: LocalGarden, importId: string) {
  const catalog = catalogImportRequest(garden, importId);
  let plantIds: Record<string, string> = {};
  if (catalog.ownPlants.length + catalog.overrides.length > 0) {
    ({ plantIds } = await api<ImportCatalogResponse>('/api/catalog/import', {
      method: 'POST',
      body: JSON.stringify(catalog),
    }));
  }
  if (garden.beds.length > 0) {
    await api<ImportGardenResponse>('/api/garden/import', {
      method: 'POST',
      body: JSON.stringify(gardenImportRequest(garden, importId, plantIds)),
    });
  }
}

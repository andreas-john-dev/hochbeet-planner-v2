import {
  type ImportCatalogRequest,
  type ImportCatalogResponse,
  type ImportGardenRequest,
  type ImportGardenResponse,
  PlantSchema,
} from '@hochbeet/contracts';
import { ulid } from 'ulid';
import type { ApiFetch } from './api';
import { i18n } from './i18n';
import { intlLocale, type Language } from './language';
import { GUEST_IMPORT_ID_KEY } from './local-api/keys';
import type { LocalGarden } from './local-api/store';

/** What the guest left in this browser, for the question after sign-in. */
export function guestDataSummary(garden: LocalGarden) {
  return {
    beds: garden.beds.length,
    plantings: garden.plantings.length,
    ownPlants: (garden.ownPlants ?? []).filter((p) => !p.archived).length,
    overrides: Object.keys(garden.overrides ?? {}).length,
    sowings: (garden.sowings ?? []).length,
  };
}

export function hasGuestData(garden: LocalGarden): boolean {
  const { beds, ownPlants, overrides, sowings } = guestDataSummary(garden);
  return beds + ownPlants + overrides + sowings > 0;
}

/** „2 Beete, 5 Pflanzungen, 1 Anzucht und 1 eigene Sorte“ */
export function describeGuestData(garden: LocalGarden, language: Language): string {
  const t = i18n.getFixedT(language, 'guestImport');
  const summary = guestDataSummary(garden);
  const kinds = ['beds', 'plantings', 'sowings', 'ownPlants', 'overrides'] as const;
  const named = kinds
    .filter((kind) => summary[kind] > 0)
    .map((kind) => t(`data.${kind}`, { count: summary[kind] }));
  return new Intl.ListFormat(intlLocale(language), { type: 'conjunction' }).format(named);
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

/**
 * Beds, plantings and sowing batches, with plantings and batches pointing to the new ids of
 * imported own plants. The garden service gives everything new ids and maps `sowingId`.
 * The guest's view goes along; the account only takes it while it has no settings.
 */
export function gardenImportRequest(
  garden: LocalGarden,
  importId: string,
  plantIds: Readonly<Record<string, string>>,
): ImportGardenRequest {
  const plantId = (id: string) => plantIds[id] ?? id;
  return {
    importId,
    beds: garden.beds,
    plantings: garden.plantings.map((p) => ({ ...p, plantId: plantId(p.plantId) })),
    sowings: (garden.sowings ?? []).map((s) => ({ ...s, plantId: plantId(s.plantId) })),
    ...(garden.settings ? { view: garden.settings.view } : {}),
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
 * plantings and batches need the new ids of own plants, then beds, plantings and batches.
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
  if (garden.beds.length + (garden.sowings ?? []).length > 0) {
    await api<ImportGardenResponse>('/api/garden/import', {
      method: 'POST',
      body: JSON.stringify(gardenImportRequest(garden, importId, plantIds)),
    });
  }
}

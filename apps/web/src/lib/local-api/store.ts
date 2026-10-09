import {
  BedSchema,
  type CatalogPlant,
  CatalogPlantSchema,
  type Bed,
  type Planting,
  type PlantOverride,
  PlantOverrideSchema,
  PlantingSchema,
} from '@hochbeet/contracts';
import { z } from 'zod';

/** An own plant; `requestedAt` (ISO date) is set while its publication is pending. */
export type OwnPlant = CatalogPlant & { archived?: boolean; requestedAt?: string };

const OwnPlantSchema = CatalogPlantSchema.extend({
  archived: z.boolean().optional(),
  requestedAt: z.string().optional(),
});

/** Data of one user: the garden, adjustments of global plants and own plants. */
export interface LocalGarden {
  beds: Bed[];
  plantings: Planting[];
  /** Overrides by plant id; missing in data written before adjustments existed. */
  overrides?: Record<string, PlantOverride>;
  /** Own plants as the catalogue lists them; archived ones stay for existing plantings. */
  ownPlants?: OwnPlant[];
}

/** Storage of one user's data; the local API reads and writes the whole garden at once. */
export interface GardenRepository {
  read(): LocalGarden;
  write(garden: LocalGarden): void;
}

export const emptyGarden = (): LocalGarden => ({ beds: [], plantings: [] });

export const GUEST_STORAGE_KEY = 'hochbeet-guest';
/** Unreadable data is moved here instead of being lost silently. */
export const GUEST_BACKUP_KEY = 'hochbeet-guest-backup';
export const GUEST_STORAGE_VERSION = 1;

/**
 * Steps from an older version to the next one, keyed by the old version. Empty while there
 * is only version 1; a change of the stored shape adds a step and bumps the version.
 */
const migrations: Record<number, (garden: unknown) => unknown> = {};

const validItems = <T>(schema: z.ZodType<T>, items: unknown): T[] =>
  Array.isArray(items) ? items.flatMap((item) => schema.safeParse(item).data ?? []) : [];

/**
 * A garden from untrusted storage: invalid entries are dropped one by one, so a single broken
 * planting does not cost the user all beds. Plantings of missing beds go too.
 */
export function sanitizeGarden(raw: unknown): LocalGarden {
  const data = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const beds = validItems(BedSchema, data.beds);
  const bedIds = new Set(beds.map((b) => b.id));
  const plantings = validItems(PlantingSchema, data.plantings).filter((p) => bedIds.has(p.bedId));
  const overrides = Object.fromEntries(
    Object.entries((data.overrides ?? {}) as Record<string, unknown>).flatMap(([id, value]) => {
      const parsed = PlantOverrideSchema.safeParse(value);
      return parsed.success ? [[id, parsed.data]] : [];
    }),
  );
  const ownPlants = validItems(OwnPlantSchema, data.ownPlants);
  return { beds, plantings, overrides, ownPlants };
}

const EnvelopeSchema = z.object({ version: z.number().int().min(1), garden: z.unknown() });

/** The stored value migrated to the current version, or undefined if it cannot be read. */
export function loadGarden(stored: string | null): LocalGarden | undefined {
  if (stored === null) return emptyGarden();
  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    return undefined;
  }
  const envelope = EnvelopeSchema.safeParse(raw);
  if (!envelope.success) return undefined;
  let { version, garden } = envelope.data;
  while (version < GUEST_STORAGE_VERSION) {
    const step = migrations[version];
    if (!step) return undefined;
    garden = step(garden);
    version += 1;
  }
  // Written by a newer app version: better keep it than guess its shape.
  if (version > GUEST_STORAGE_VERSION) return undefined;
  return sanitizeGarden(garden);
}

/**
 * The guest's data in localStorage under a versioned envelope. Data that cannot be read is
 * copied to a backup key once and replaced by an empty garden, so the app always starts.
 */
export function createGuestRepository(storage: Storage = localStorage): GardenRepository {
  return {
    read() {
      const stored = storage.getItem(GUEST_STORAGE_KEY);
      const garden = loadGarden(stored);
      if (garden) return garden;
      if (stored !== null) storage.setItem(GUEST_BACKUP_KEY, stored);
      storage.removeItem(GUEST_STORAGE_KEY);
      return emptyGarden();
    },
    write(garden) {
      storage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({ version: GUEST_STORAGE_VERSION, garden }),
      );
    },
  };
}

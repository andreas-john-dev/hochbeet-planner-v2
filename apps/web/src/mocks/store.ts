import { seedPlants } from '@hochbeet/catalog-seed';
import type { Bed, CatalogPlant, Plant, Planting, PlantOverride } from '@hochbeet/contracts';

/** Data of one mock user: the garden, adjustments of global plants and own plants. */
export interface MockGarden {
  beds: Bed[];
  plantings: Planting[];
  /** Overrides by plant id; missing in data seeded before adjustments existed. */
  overrides?: Record<string, PlantOverride>;
  /** Own plants as the catalogue lists them; archived ones stay for existing plantings. */
  ownPlants?: OwnMockPlant[];
}

/** An own plant; `requestedAt` (ISO date) is set while its publication is pending. */
export type OwnMockPlant = CatalogPlant & { archived?: boolean; requestedAt?: string };

const STORAGE_KEY = 'hochbeet-mock-api';
const CATALOG_KEY = 'hochbeet-mock-catalog';

/**
 * Mock API data per user plus the global catalogue shared by all users (the start catalogue
 * until admins change it), kept in localStorage so it survives reloads on the dev server.
 */
export class MockStore {
  constructor(private readonly storage: Storage = localStorage) {}

  read(userId: string): MockGarden {
    return this.all()[userId] ?? { beds: [], plantings: [] };
  }

  write(userId: string, garden: MockGarden) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify({ ...this.all(), [userId]: garden }));
  }

  /** All users with data, for the admin queue across users. */
  users(): [string, MockGarden][] {
    return Object.entries(this.all());
  }

  readCatalog(): Plant[] {
    const raw = this.storage.getItem(CATALOG_KEY);
    return raw ? (JSON.parse(raw) as Plant[]) : [...seedPlants];
  }

  writeCatalog(plants: Plant[]) {
    this.storage.setItem(CATALOG_KEY, JSON.stringify(plants));
  }

  private all(): Record<string, MockGarden> {
    const raw = this.storage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, MockGarden>) : {};
  }
}

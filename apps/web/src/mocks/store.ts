import { seedPlants } from '@hochbeet/catalog-seed';
import type { Plant } from '@hochbeet/contracts';
import { emptyGarden, type GardenRepository, type LocalGarden } from '@/lib/local-api/store';

const STORAGE_KEY = 'hochbeet-mock-api';
const CATALOG_KEY = 'hochbeet-mock-catalog';

/**
 * Mock API data per user plus the global catalogue shared by all users (the start catalogue
 * until admins change it), kept in localStorage so it survives reloads on the dev server.
 */
export class MockStore {
  constructor(private readonly storage: Storage = localStorage) {}

  read(userId: string): LocalGarden {
    return this.all()[userId] ?? emptyGarden();
  }

  write(userId: string, garden: LocalGarden) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify({ ...this.all(), [userId]: garden }));
  }

  /** One user's data for the local API. */
  repository(userId: string): GardenRepository {
    return {
      read: () => this.read(userId),
      write: (garden) => {
        this.write(userId, garden);
      },
    };
  }

  /** All users with data, for the admin queue across users. */
  users(): [string, LocalGarden][] {
    return Object.entries(this.all());
  }

  readCatalog(): Plant[] {
    const raw = this.storage.getItem(CATALOG_KEY);
    return raw ? (JSON.parse(raw) as Plant[]) : [...seedPlants];
  }

  writeCatalog(plants: Plant[]) {
    this.storage.setItem(CATALOG_KEY, JSON.stringify(plants));
  }

  private all(): Record<string, LocalGarden> {
    const raw = this.storage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalGarden>) : {};
  }
}

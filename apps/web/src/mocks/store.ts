import type { Bed, Planting } from '@hochbeet/contracts';

/** Garden data of one mock user. */
export interface MockGarden {
  beds: Bed[];
  plantings: Planting[];
}

const STORAGE_KEY = 'hochbeet-mock-api';

/** Mock API data per user, kept in localStorage so it survives reloads on the dev server. */
export class MockStore {
  constructor(private readonly storage: Storage = localStorage) {}

  read(userId: string): MockGarden {
    return this.all()[userId] ?? { beds: [], plantings: [] };
  }

  write(userId: string, garden: MockGarden) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify({ ...this.all(), [userId]: garden }));
  }

  private all(): Record<string, MockGarden> {
    const raw = this.storage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, MockGarden>) : {};
  }
}

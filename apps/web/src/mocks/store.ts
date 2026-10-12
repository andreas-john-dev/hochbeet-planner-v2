import { seedPlants } from '@hochbeet/catalog-seed';
import type { AssistantMemory, Plant } from '@hochbeet/contracts';
import { emptyGarden, type GardenRepository, type LocalGarden } from '@/lib/local-api/store';

const STORAGE_KEY = 'hochbeet-mock-api';
const CATALOG_KEY = 'hochbeet-mock-catalog';
const IMPORTS_KEY = 'hochbeet-mock-imports';
/** Questions to the mock assistant per user and day; Playwright sets it to test the limit. */
export const ASSISTANT_QUOTA_KEY = 'hochbeet-mock-assistant';
/** Preferences the mock assistant remembers per user; Playwright seeds it. */
export const ASSISTANT_MEMORY_KEY = 'hochbeet-mock-assistant-memory';

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

  /** Stored response of an import, per user, service and import id (idempotency). */
  readImport(key: string): unknown {
    const raw = this.storage.getItem(IMPORTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>)[key] : undefined;
  }

  writeImport(key: string, result: unknown) {
    const raw = this.storage.getItem(IMPORTS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    this.storage.setItem(IMPORTS_KEY, JSON.stringify({ ...all, [key]: result }));
  }

  /**
   * Counts one question of `userId` on `day`, like the agent's daily quota. Returns the
   * questions left, or undefined once `limit` is reached.
   */
  takeAssistantQuestion(userId: string, day: string, limit: number): number | undefined {
    const raw = this.storage.getItem(ASSISTANT_QUOTA_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, { day: string; count: number }>) : {};
    const today = all[userId];
    const used = today?.day === day ? today.count : 0;
    if (used >= limit) return undefined;
    all[userId] = { day, count: used + 1 };
    this.storage.setItem(ASSISTANT_QUOTA_KEY, JSON.stringify(all));
    return limit - used - 1;
  }

  /** What the mock assistant remembers about `userId`, newest first. */
  readMemories(userId: string): AssistantMemory[] {
    return this.allMemories()[userId] ?? [];
  }

  remember(userId: string, memory: AssistantMemory) {
    const all = this.allMemories();
    all[userId] = [memory, ...(all[userId] ?? [])];
    this.storage.setItem(ASSISTANT_MEMORY_KEY, JSON.stringify(all));
  }

  /** Deletes everything the mock assistant remembers about `userId`; returns how much. */
  forget(userId: string): number {
    const all = this.allMemories();
    const count = all[userId]?.length ?? 0;
    // An empty list rather than no entry: Playwright seeds only users without one.
    this.storage.setItem(ASSISTANT_MEMORY_KEY, JSON.stringify({ ...all, [userId]: [] }));
    return count;
  }

  private allMemories(): Record<string, AssistantMemory[]> {
    const raw = this.storage.getItem(ASSISTANT_MEMORY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AssistantMemory[]>) : {};
  }

  private all(): Record<string, LocalGarden> {
    const raw = this.storage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalGarden>) : {};
  }
}

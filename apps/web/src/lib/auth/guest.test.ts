import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GUEST_BACKUP_KEY, GUEST_STORAGE_KEY } from '@/lib/local-api/keys';
import { deleteGuestData, GUEST_MODE_KEY, readGuestMode, writeGuestMode } from './guest';
import { AuthStore } from './context';

describe('guest mode storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('remembers guest mode across reloads', () => {
    expect(readGuestMode()).toBe(false);
    writeGuestMode(true);
    expect(localStorage.getItem(GUEST_MODE_KEY)).toBe('1');
    expect(readGuestMode()).toBe(true);
    writeGuestMode(false);
    expect(readGuestMode()).toBe(false);
  });

  it('deletes only the guest data', () => {
    localStorage.setItem(GUEST_STORAGE_KEY, '{}');
    localStorage.setItem(GUEST_BACKUP_KEY, '{}');
    localStorage.setItem('hochbeet-theme', 'dark');
    deleteGuestData();
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(GUEST_BACKUP_KEY)).toBeNull();
    expect(localStorage.getItem('hochbeet-theme')).toBe('dark');
  });

  it('treats blocked storage as „no guest mode“ instead of failing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readGuestMode()).toBe(false);
    expect(() => {
      writeGuestMode(true);
    }).not.toThrow();
  });
});

describe('AuthStore', () => {
  it('is never in guest mode while a user is signed in', () => {
    const store = new AuthStore();
    store.set(null, true);
    expect(store.guest).toBe(true);
    store.set({ userId: 'u', email: 'a@example.com', groups: [] }, true);
    expect(store.guest).toBe(false);
  });
});

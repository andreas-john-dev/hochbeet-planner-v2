import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';
import type { Access } from './pages';

/** Fixed "now" so date labels and screenshots are stable: Wednesday, 7 October 2026. */
export const NOW = new Date('2026-10-07T10:00:00+02:00');

/** Seed users of the mock auth adapter (apps/web/src/lib/auth/mock-adapter.ts). */
export const USERS = {
  user: { email: 'test@example.com', password: 'Gemuese1!' },
  admin: { email: 'admin@example.com', password: 'Gemuese1!' },
} as const;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(NOW);
    await use(page);
  },
});

export { expect };

/** Accounts with a stored login state. */
export type Account = Exclude<Access, 'public' | 'guest'>;

/** localStorage flag of guest mode (apps/web/src/lib/auth/guest.ts). */
export const GUEST_MODE_KEY = 'hochbeet-guest-mode';

/** Login state per account, written by the `setup` project (tests/auth.setup.ts). */
export const authFile = (access: Account) =>
  resolve(import.meta.dirname, '../.auth', `${access}.json`);

interface StorageState {
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
}

/**
 * Starts the page signed in as the given account (or in guest mode), from the storageState of the `setup`
 * project. Each test chooses its account itself and some switch accounts midway, so the
 * stored localStorage is applied per page instead of per project. Only seeds it once, so a
 * sign-out in the test sticks across reloads.
 */
export async function signInAs(page: Page, access: Access) {
  if (access === 'public') return;
  if (access === 'guest') {
    // Only once, so ending guest mode in the test sticks across reloads.
    await page.addInitScript((key) => {
      if (!sessionStorage.getItem('guest-seeded')) {
        sessionStorage.setItem('guest-seeded', '1');
        localStorage.setItem(key, '1');
      }
    }, GUEST_MODE_KEY);
    return;
  }
  const state = JSON.parse(readFileSync(authFile(access), 'utf8')) as StorageState;
  const entries = state.origins.flatMap((o) => o.localStorage);
  await page.addInitScript((items) => {
    for (const { name, value } of items) {
      if (!localStorage.getItem(name)) localStorage.setItem(name, value);
    }
  }, entries);
}

/** Opens a page and waits until heading and web font are ready. */
export async function open(page: Page, path: string, heading: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

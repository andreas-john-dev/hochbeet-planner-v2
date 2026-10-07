import { test as base, expect, type Page } from '@playwright/test';
import type { Access } from './pages';

/** Fixed "now" so date labels and screenshots are stable: Wednesday, 7 October 2026. */
export const NOW = new Date('2026-10-07T10:00:00+02:00');

/** Seed users of the mock auth adapter (apps/web/src/lib/auth/mock-adapter.ts). */
export const USERS = {
  user: { email: 'test@example.com', password: 'Gemuese1!' },
  admin: { email: 'admin@example.com', password: 'Gemuese1!' },
} as const;

const MOCK_STORAGE_KEY = 'hochbeet-mock-auth';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(NOW);
    await use(page);
  },
});

export { expect };

/**
 * Starts the page signed in as the given account (mock auth of the dev server).
 * Only seeds the session once, so a sign-out in the test sticks across reloads.
 */
export async function signInAs(page: Page, access: Access) {
  if (access === 'public') return;
  const { email } = USERS[access];
  await page.addInitScript(
    ([key, session]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ session }));
    },
    [MOCK_STORAGE_KEY, email] as const,
  );
}

/** Opens a page and waits until heading and web font are ready. */
export async function open(page: Page, path: string, heading: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

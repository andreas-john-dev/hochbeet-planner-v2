import { test as base, expect, type Page } from '@playwright/test';

/** Fixed "now" so date labels and screenshots are stable: Wednesday, 7 October 2026. */
export const NOW = new Date('2026-10-07T10:00:00+02:00');

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(NOW);
    await use(page);
  },
});

export { expect };

/** Opens a page and waits until heading and web font are ready. */
export async function open(page: Page, path: string, heading: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { appPages } from './pages';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`shell matches screenshot (${colorScheme})`, async ({ page }) => {
    await signInAs(page, 'admin');
    await page.emulateMedia({ colorScheme });
    await open(page, '/beete', 'Meine Beete');
    await expect(page.getByText('5. – 11. Oktober 2026')).toBeVisible();
    await expect(page).toHaveScreenshot(`shell-${colorScheme}.png`);
  });
}

test('navigates between all sections as admin', async ({ page }) => {
  await signInAs(page, 'admin');
  await open(page, '/', 'Meine Beete');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).filter({ visible: true });
  for (const { heading, navLabel } of appPages.filter((p) => p.navLabel && p.id !== 'beete')) {
    await nav.getByRole('link', { name: navLabel }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

async function expectNoHorizontalOverflow(page: Page, path: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${path}`).toBe(0);
}

test('auth pages have no horizontal scrollbar at 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const { path, heading } of appPages.filter((p) => p.access === 'public')) {
    await open(page, path, heading);
    await expectNoHorizontalOverflow(page, path);
  }
});

test('app pages have no horizontal scrollbar at 375 px', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.setViewportSize({ width: 375, height: 812 });
  for (const { path, heading } of appPages.filter((p) => p.access !== 'public')) {
    await open(page, path, heading);
    await expectNoHorizontalOverflow(page, path);
  }
});

test('theme toggle cycles to dark and keeps it after reload', async ({ page }) => {
  await signInAs(page, 'user');
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page, '/beete', 'Meine Beete');
  const toggle = page.getByRole('button', { name: /^Farbschema:/ }).filter({ visible: true });
  await expect(toggle).toHaveAccessibleName(/^Farbschema: System/);
  await toggle.click(); // System -> Hell
  await toggle.click(); // Hell -> Dunkel
  await expect(toggle).toHaveAccessibleName(/^Farbschema: Dunkel/);
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

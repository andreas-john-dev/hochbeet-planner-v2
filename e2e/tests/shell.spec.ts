import type { Page } from '@playwright/test';
import { expect, open, signInAs, test, USERS } from './fixtures';
import { seedGarden } from './garden';
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
  // One user for all pages: the seeds of all pages that need data, merged.
  const seeds = appPages.flatMap((p) => (p.seed ? [p.seed] : []));
  const unique = (items: unknown[]) => [
    ...new Map(items.map((item) => [(item as { id: string }).id, item])).values(),
  ];
  await seedGarden(
    page,
    {
      beds: unique(seeds.flatMap((s) => s.beds)),
      plantings: unique(seeds.flatMap((s) => s.plantings)),
      ownPlants: unique(seeds.flatMap((s) => s.ownPlants ?? [])),
    },
    USERS.admin.email,
  );
  await page.setViewportSize({ width: 375, height: 812 });
  for (const { path, heading } of appPages.filter(
    (p) => p.access === 'user' || p.access === 'admin',
  )) {
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

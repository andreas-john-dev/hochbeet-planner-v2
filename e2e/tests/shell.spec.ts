import { expect, open, test } from './fixtures';

const pages = [
  { path: '/beete', heading: 'Meine Beete' },
  { path: '/katalog', heading: 'Pflanzenkatalog' },
  { path: '/profil', heading: 'Profil' },
  { path: '/admin', heading: 'Administration' },
];

for (const colorScheme of ['light', 'dark'] as const) {
  test(`shell matches screenshot (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await open(page, '/beete', 'Meine Beete');
    await expect(page.getByText('5. – 11. Oktober 2026')).toBeVisible();
    await expect(page).toHaveScreenshot(`shell-${colorScheme}.png`);
  });
}

test('navigates between all sections', async ({ page }) => {
  await open(page, '/', 'Meine Beete');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).filter({ visible: true });
  for (const { heading } of pages.slice(1)) {
    const label = { Pflanzenkatalog: 'Katalog', Profil: 'Profil', Administration: 'Admin' }[
      heading
    ];
    await nav.getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

test('has no horizontal scrollbar at 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const { path, heading } of pages) {
    await open(page, path, heading);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${path}`).toBe(0);
  }
});

test('theme toggle cycles to dark and keeps it after reload', async ({ page }) => {
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

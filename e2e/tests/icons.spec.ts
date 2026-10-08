import { expect, open, signInAs, test } from './fixtures';

const GALLERY = '/dev/icons';

test('icon gallery shows every plant icon in three sizes', async ({ page }) => {
  await open(page, GALLERY, 'Icon-Galerie');
  // 56 seed plants and 3 category fallbacks, each in 24, 32 and 48 px.
  await expect(page.locator('svg[data-icon]')).toHaveCount(59 * 3);
  await expect(page.getByRole('img', { name: 'Radieschen' })).toHaveCount(3);
  await expect(page.getByRole('img', { name: 'Eigenes Kraut' })).toHaveCount(3);
  for (const size of ['24', '32', '48']) {
    await expect(page.locator(`svg[data-icon="tomate"][width="${size}"]`)).toBeVisible();
  }
});

test('icon gallery stays open for signed-in users', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, GALLERY, 'Icon-Galerie');
  await expect(page).toHaveURL(GALLERY);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`icon gallery matches screenshot (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await open(page, GALLERY, 'Icon-Galerie');
    await expect(page).toHaveScreenshot(`icons-${colorScheme}.png`, { fullPage: true });
  });
}

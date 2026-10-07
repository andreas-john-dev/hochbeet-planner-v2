import { expect, test } from '@playwright/test';

test('browser renders a page', async ({ page }) => {
  await page.setContent('<h1>Hochbeet-Planer</h1>');
  await expect(page.getByRole('heading', { name: 'Hochbeet-Planer' })).toBeVisible();
});

import { expect, open, signInAs, test } from './fixtures';

// Test data never outlives a test: each test gets a fresh browser context, and the mock API
// keeps its data only in that context's localStorage. These two tests prove it in order.
test.describe.configure({ mode: 'serial' });

test('a test creates a bed', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/beete', 'Meine Beete');
  await page.getByRole('button', { name: 'Erstes Beet anlegen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Beet anlegen' });
  await dialog.getByLabel('Name').fill('Bleibt nicht');
  await dialog.getByRole('button', { name: 'Beet anlegen' }).click();
  await expect(page.getByRole('article', { name: 'Bleibt nicht' })).toBeVisible();
});

test('the next test starts without it', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/beete', 'Meine Beete');
  await expect(page.getByRole('heading', { name: 'Noch keine Beete' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hochbeet-mock-api'))).toBeNull();
});

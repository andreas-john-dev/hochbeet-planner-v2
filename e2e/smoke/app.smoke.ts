import { expect, test } from '@playwright/test';

test('start page loads and redirects to the beds', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/beete$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible();
});

test('deep link survives a reload (SPA fallback)', async ({ page }) => {
  const response = await page.goto('/beete/123');
  expect(response?.status()).toBe(200);
  await page.reload();
  // The app is rendered; the route itself does not exist yet and shows the 404 page.
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).first()).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
});

test('config.json is served fresh and contains the Cognito settings', async ({ request }) => {
  const response = await request.get('/config.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-cache');
  const config = (await response.json()) as Record<string, unknown>;
  expect(config).toEqual({
    region: 'eu-central-1',
    userPoolId: expect.stringMatching(/^eu-central-1_\w+$/) as unknown,
    userPoolClientId: expect.stringMatching(/^\w+$/) as unknown,
  });
});

test('hashed assets are cached long', async ({ page, request }) => {
  await page.goto('/beete');
  const script = await page.locator('script[type="module"][src^="/assets/"]').getAttribute('src');
  expect(script).toBeTruthy();
  const response = await request.get(script ?? '');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
});

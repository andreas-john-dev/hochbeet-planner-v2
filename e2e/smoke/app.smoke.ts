import { expect, test } from '@playwright/test';

// Read-only: no sign-in against prod here (a dedicated test user follows in T-34).

test('start page sends signed-out visitors to the sign-in page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/anmelden/);
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  await expect(page.getByLabel('E-Mail')).toBeVisible();
});

test('protected deep links survive a reload and keep the target', async ({ page }) => {
  const response = await page.goto('/katalog');
  expect(response?.status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/katalog');
});

test('unknown deep links are served by the SPA (no CloudFront 403/404)', async ({ page }) => {
  const response = await page.goto('/gibt-es-nicht/123');
  expect(response?.status()).toBe(200);
  await page.reload();
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

test('catalog API is routed through CloudFront and rejects requests without a valid token', async ({
  request,
}) => {
  const withoutToken = await request.get('/api/catalog/plants');
  expect(withoutToken.status()).toBe(401);
  const withBadToken = await request.get('/api/catalog/plants', {
    headers: { Authorization: 'Bearer not-a-jwt' },
  });
  expect(withBadToken.status()).toBe(401);
});

test('garden API is routed through CloudFront and rejects requests without a valid token', async ({
  request,
}) => {
  expect((await request.get('/api/garden/beds')).status()).toBe(401);
  const withBadToken = await request.get('/api/garden/beds', {
    headers: { Authorization: 'Bearer not-a-jwt' },
  });
  expect(withBadToken.status()).toBe(401);
});

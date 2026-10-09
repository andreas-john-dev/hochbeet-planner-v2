import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { test as setup } from '@playwright/test';
import { authFile, expect, USERS } from './fixtures';

// Signs in once per test account through the real sign-in page and stores the login state
// (storageState). Tests start from it via signInAs() instead of signing in again.

for (const access of ['user', 'admin'] as const) {
  setup(`sign in as ${access}`, async ({ page }) => {
    const { email, password } = USERS[access];
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail').fill(email);
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible();
    mkdirSync(dirname(authFile(access)), { recursive: true });
    await page.context().storageState({ path: authFile(access) });
  });
}

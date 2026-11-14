import { expect, open, signInAs, test } from './fixtures';

test('switching to English in the profile changes the navigation and survives a reload', async ({
  page,
}) => {
  await signInAs(page, 'user');
  await open(page, '/profil', 'Profil');
  await page
    .getByRole('group', { name: 'Sprache' })
    .getByRole('button', { name: 'English' })
    .click();

  await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Beds' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Seedlings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Raised Bed Planner');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Catalogue' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'English' }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Deutsch' }).click();
  await expect(
    page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Anzucht' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test.describe('with an English browser', () => {
  test.use({ language: null, locale: 'en-US' });

  test('the sign-in page follows the browser language', async ({ page }) => {
    await open(page, '/anmelden', 'Sign in');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try without an account' })).toBeVisible();
  });

  test('the switch on the sign-in page changes to German and keeps it', async ({ page }) => {
    await open(page, '/anmelden', 'Sign in');
    await page.getByRole('button', { name: 'Deutsch' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
    await page.getByRole('link', { name: 'Registrieren' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Registrieren' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Registrieren' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  });

  test('form errors appear in English', async ({ page }) => {
    await open(page, '/anmelden', 'Sign in');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Please enter your password.')).toBeVisible();
  });
});

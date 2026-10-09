import { expect, open, signInAs, test, USERS } from './fixtures';
import { appPages, protectedPages } from './pages';

const MOCK_CODE = '123456';

test('signs in and out with a test user', async ({ page }) => {
  await open(page, '/', 'Anmelden');
  await page.getByLabel('E-Mail').fill(USERS.user.email);
  await page.getByLabel('Passwort').fill(USERS.user.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible();
  await expect(page).toHaveURL(/\/beete$/);

  // Desktop has the button in the sidebar, phones on the profile page.
  const sidebarSignOut = page.getByRole('button', { name: 'Abmelden' }).filter({ visible: true });
  if ((await sidebarSignOut.count()) === 0) {
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .filter({ visible: true })
      .getByRole('link', { name: 'Profil' })
      .click();
  }
  await page.getByRole('button', { name: 'Abmelden' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();

  // Signed out for good: protected pages send us back to the sign-in page.
  await page.goto('/beete');
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
});

for (const { path } of protectedPages) {
  test(`redirects ${path} to the sign-in page when signed out`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('redirect')).toBe(path);
  });
}

test('returns to the requested page after sign-in', async ({ page }) => {
  await open(page, '/katalog', 'Anmelden');
  await page.getByLabel('E-Mail').fill(USERS.user.email);
  await page.getByLabel('Passwort').fill(USERS.user.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pflanzenkatalog' })).toBeVisible();
});

test('shows a German error for a wrong password', async ({ page }) => {
  await open(page, '/anmelden', 'Anmelden');
  await page.getByLabel('E-Mail').fill(USERS.user.email);
  await page.getByLabel('Passwort').fill('falsch');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('alert')).toHaveText('E-Mail oder Passwort ist falsch.');
});

test('registers with confirmation code and signs in', async ({ page }) => {
  await open(page, '/registrieren', 'Registrieren');
  await page.getByLabel('E-Mail').fill('neu@example.com');
  await page.getByLabel('Passwort', { exact: true }).fill('Kohlrabi1!');
  await page.getByLabel('Passwort wiederholen').fill('Kohlrabi1!');
  await page.getByRole('button', { name: 'Registrieren' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'E-Mail bestätigen' })).toBeVisible();
  await page.getByLabel('Bestätigungscode').fill(MOCK_CODE);
  await page.getByRole('button', { name: 'Bestätigen' }).click();

  await expect(page.getByRole('status')).toHaveText(/Konto ist bestätigt/);
  await expect(page.getByLabel('E-Mail')).toHaveValue('neu@example.com');
  await page.getByLabel('Passwort').fill('Kohlrabi1!');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible();
});

test('resets a forgotten password', async ({ page }) => {
  await open(page, '/anmelden', 'Anmelden');
  await page.getByRole('link', { name: 'Passwort vergessen?' }).click();
  await page.getByLabel('E-Mail').fill(USERS.user.email);
  await page.getByRole('button', { name: 'Code senden' }).click();
  await page.getByLabel('Code').fill(MOCK_CODE);
  await page.getByLabel('Neues Passwort').fill('Tomate123!');
  await page.getByRole('button', { name: 'Passwort speichern' }).click();
  await expect(page.getByRole('status')).toHaveText(/Passwort wurde geändert/);
});

test('shows the admin section only to admins', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/beete', 'Meine Beete');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).filter({ visible: true });
  await expect(nav.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  // A direct call shows a 403 page instead of the admin area.
  await open(page, '/admin', 'Kein Zugriff');
  await expect(page.getByText(/Fehler 403/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Warteschlange' })).toHaveCount(0);
  await open(page, `/admin/sorten/neu`, 'Kein Zugriff');
});

test('lists every page in pages.ts', () => {
  expect(new Set(appPages.map((p) => p.path)).size).toBe(appPages.length);
});

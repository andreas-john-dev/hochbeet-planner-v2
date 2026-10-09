import type { Page } from '@playwright/test';
import { expect, open, signInAs, test, USERS } from './fixtures';
import { bed, GUEST_STORAGE_KEY, ownPlant, planting, seedGarden, seedGuestGarden } from './garden';

const MOCK_CODE = '123456';
const GUEST_BED = '01J9ZQ3W8D6V2K5M7N8P9R0BED';
const OWN = '01J9ZQ3W8D6V2K5M7N8P9R0WNA';
const TOMATO = '01M49THV00QS1SEJEM64991JH5';

/** A guest with a bed, a tomato and a planting of an own plant. */
const guestGarden = {
  beds: [bed(GUEST_BED, 'Gastbeet', 200, 100)],
  plantings: [
    planting('01J9ZQ3W8D6V2K5M7N8P9R0PA1', GUEST_BED, TOMATO, {
      x: 40,
      y: 50,
      startDate: '2026-10-05',
    }),
    planting('01J9ZQ3W8D6V2K5M7N8P9R0PA2', GUEST_BED, OWN, {
      x: 120,
      y: 50,
      startDate: '2026-10-05',
    }),
  ],
  ownPlants: [ownPlant(OWN, 'Haferwurzel')],
};

const importDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Beete aus dem Gastmodus übernehmen?' });

test('a guest signs up and takes the beds into the new account', async ({ page }) => {
  await signInAs(page, 'guest');
  await seedGuestGarden(page, guestGarden);
  await open(page, '/beete', 'Meine Beete');
  await page.getByTestId('guest-banner').getByRole('link', { name: 'Konto anlegen' }).click();

  await page.getByLabel('E-Mail').fill('gast@example.com');
  await page.getByLabel('Passwort', { exact: true }).fill('Kohlrabi1!');
  await page.getByLabel('Passwort wiederholen').fill('Kohlrabi1!');
  await page.getByRole('button', { name: 'Registrieren' }).click();
  await page.getByLabel('Bestätigungscode').fill(MOCK_CODE);
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await page.getByLabel('Passwort').fill('Kohlrabi1!');
  await page.getByRole('button', { name: 'Anmelden' }).click();

  const dialog = importDialog(page);
  await expect(dialog).toContainText(
    'In diesem Browser liegen 1 Beet, 2 Pflanzungen und 1 eigene Sorte aus dem Gastmodus.',
  );
  await dialog.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('guest-banner')).toHaveCount(0);

  // The bed is in the account, with both plantings; the own plant came along.
  await page.getByRole('article', { name: 'Gastbeet' }).getByRole('link').first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gastbeet' })).toBeVisible();
  await expect(page.locator('[data-testid^="planting-"]')).toHaveCount(2);
  await open(page, '/katalog', 'Pflanzenkatalog');
  await expect(page.getByRole('link', { name: /Haferwurzel/ })).toBeVisible();

  // Nothing left in this browser, and no second question after a reload.
  expect(await page.evaluate((key) => localStorage.getItem(key), GUEST_STORAGE_KEY)).toBeNull();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Pflanzenkatalog' })).toBeVisible();
  await expect(importDialog(page)).toHaveCount(0);
});

test('signing in with beds in the account adds the guest beds to them', async ({ page }) => {
  await seedGarden(page, {
    beds: [bed('01J9ZQ3W8D6V2K5M7N8P9R0ACC', 'Kontobeet', 100, 50)],
    plantings: [],
  });
  await seedGuestGarden(page, guestGarden);
  await open(page, '/anmelden', 'Anmelden');
  await page.getByLabel('E-Mail').fill(USERS.user.email);
  await page.getByLabel('Passwort').fill(USERS.user.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();

  const dialog = importDialog(page);
  await expect(dialog).toContainText('Dein Konto hat schon Beete');
  await dialog.getByRole('button', { name: 'Lokale Beete hinzufügen' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('article', { name: 'Kontobeet' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Gastbeet' })).toBeVisible();
});

test('discarding deletes the guest beds from this browser', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGuestGarden(page, guestGarden);
  await page.goto('/beete');
  const dialog = importDialog(page);
  await dialog.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Noch keine Beete' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), GUEST_STORAGE_KEY)).toBeNull();
});

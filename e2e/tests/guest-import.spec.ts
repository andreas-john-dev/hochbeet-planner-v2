import type { Page } from '@playwright/test';
import { expect, open, signInAs, test, USERS } from './fixtures';
import {
  bed,
  GUEST_STORAGE_KEY,
  MOCK_API_KEY,
  ownPlant,
  planting,
  seedGarden,
  seedGuestGarden,
  sowing,
} from './garden';

const MOCK_CODE = '123456';
const GUEST_BED = '01J9ZQ3W8D6V2K5M7N8P9R0BED';
const OWN = '01J9ZQ3W8D6V2K5M7N8P9R0WNA';
const TOMATO = '01M49THV00QS1SEJEM64991JH5';
const OWN_SOWING = '01J9ZQ3W8D6V2K5M7N8P9R0SW1';

/** A guest with a bed, a tomato, a planting of an own plant and a batch of the own plant. */
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
      sowingId: OWN_SOWING,
    }),
  ],
  ownPlants: [ownPlant(OWN, 'Haferwurzel')],
  sowings: [sowing(OWN_SOWING, OWN, { stage: 'HARDENING', location: 'Fensterbank' })],
};

/** What the mock API keeps for a user: the account's data on the dev server. */
const accountData = (page: Page, email: string) =>
  page.evaluate(
    ([key, user]) =>
      (
        JSON.parse(localStorage.getItem(key) ?? '{}') as Record<
          string,
          {
            ownPlants?: { id: string; name: string }[];
            plantings: { plantId: string; sowingId?: string }[];
            sowings?: { id: string; plantId: string; stage: string; location?: string }[];
          }
        >
      )[user],
    [MOCK_API_KEY, email] as const,
  );

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
    'In diesem Browser liegen 1 Beet, 2 Pflanzungen, 1 Anzucht und 1 eigene Sorte aus dem Gastmodus.',
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

  // The batch is in the account, for the new own plant, and the planting points to it.
  const account = await accountData(page, 'gast@example.com');
  const newOwn = account?.ownPlants?.find((p) => p.name === 'Haferwurzel')?.id;
  expect(account?.sowings).toEqual([
    expect.objectContaining({ plantId: newOwn, stage: 'HARDENING', location: 'Fensterbank' }),
  ]);
  const [imported] = account?.sowings ?? [];
  expect(imported?.id).not.toBe(OWN_SOWING);
  expect(account?.plantings.find((p) => p.plantId === newOwn)?.sowingId).toBe(imported?.id);

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

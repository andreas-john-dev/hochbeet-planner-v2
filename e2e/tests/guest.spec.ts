import type { Page } from '@playwright/test';
import { expect, GUEST_MODE_KEY, open, signInAs, test, USERS } from './fixtures';
import { GUEST_STORAGE_KEY, ownPlant, seedGuestGarden } from './garden';

const MOCK_API_KEY = 'hochbeet-mock-api';

/** Screen point of a bed position in cm (bed 200 cm wide). */
async function screenPoint(page: Page, cm: { x: number; y: number }) {
  const box = await page.getByTestId('bed-grid').boundingBox();
  if (!box) throw new Error('bed not drawn');
  const pxPerCm = box.width / 200;
  return { x: box.x + cm.x * pxPerCm, y: box.y + cm.y * pxPerCm };
}

/** Adds a plant at a bed position: palette and click on the desktop, sheet and tap on phones. */
async function addPlant(page: Page, name: string, at: { x: number; y: number }, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Pflanze hinzufügen' }).tap();
    const sheet = page.getByRole('dialog', { name: 'Pflanze hinzufügen' });
    await sheet.getByRole('searchbox', { name: 'Sorte suchen' }).fill(name);
    await sheet.getByRole('button', { name }).tap();
    await expect(sheet).toBeHidden();
    const point = await screenPoint(page, at);
    await page.touchscreen.tap(point.x, point.y);
    await page
      .getByRole('group', { name: 'Pflanze setzen' })
      .getByRole('button', { name: 'Hier pflanzen' })
      .tap();
  } else {
    const palette = page.getByRole('complementary', { name: 'Pflanzen hinzufügen' });
    await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill(name);
    await palette.getByRole('button', { name }).click();
    const point = await screenPoint(page, at);
    await page.mouse.click(point.x, point.y);
  }
  await expect(page.getByTestId('placement-preview')).toHaveCount(0);
}

const storage = (page: Page) =>
  page.evaluate(
    ([guestKey, mockKey, modeKey]) => ({
      guest: localStorage.getItem(guestKey),
      mock: localStorage.getItem(mockKey),
      mode: localStorage.getItem(modeKey),
    }),
    [GUEST_STORAGE_KEY, MOCK_API_KEY, GUEST_MODE_KEY] as const,
  );

test('a guest plans a bed without an account and finds everything after a reload', async ({
  page,
  isMobile,
}) => {
  await open(page, '/anmelden', 'Anmelden');
  await page.getByRole('button', { name: 'Ohne Konto ausprobieren' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible();
  const banner = page.getByTestId('guest-banner');
  await expect(banner).toContainText('Deine Beete liegen nur in diesem Browser.');

  await page.getByRole('button', { name: 'Erstes Beet anlegen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Beet anlegen' });
  await dialog.getByLabel('Name').fill('Gastbeet');
  await dialog.getByLabel('Breite (cm)').fill('200');
  await dialog.getByLabel('Tiefe (cm)').fill('100');
  await dialog.getByRole('button', { name: 'Beet anlegen' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('article', { name: 'Gastbeet' }).getByRole('link').first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gastbeet' })).toBeVisible();
  if (isMobile) {
    await page.getByTestId('bed-canvas').evaluate((el) => {
      el.scrollIntoView({ block: 'center' });
    });
  }

  // Tomato and potato close together: bad neighbours.
  await addPlant(page, 'Tomate', { x: 60, y: 50 }, isMobile);
  await addPlant(page, 'Kartoffel', { x: 110, y: 50 }, isMobile);
  const plantings = page.locator('[data-testid^="planting-"]');
  await expect(plantings).toHaveCount(2);
  await expect(plantings.first()).toHaveAttribute('data-status', 'warning');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Gastbeet' })).toBeVisible();
  await expect(plantings).toHaveCount(2);
  await expect(plantings.first()).toHaveAttribute('data-status', 'warning');
  await expect(banner).toBeVisible();

  // Everything lives in the guest storage; the (mocked) services never saw a request.
  const stored = await storage(page);
  expect(stored.mode).toBe('1');
  expect(stored.guest).toContain('Gastbeet');
  expect(stored.mock).toBeNull();
});

test('guests reach neither profile nor admin area and cannot propose plants', async ({ page }) => {
  await signInAs(page, 'guest');
  await seedGuestGarden(page, {
    beds: [],
    plantings: [],
    ownPlants: [ownPlant('01J9ZQ3W8D6V2K5M7N8P9R0AAA', 'Haferwurzel')],
  });
  await open(page, '/beete', 'Meine Beete');
  for (const nav of await page.getByRole('navigation', { name: 'Hauptnavigation' }).all()) {
    await expect(nav.getByRole('link', { name: 'Profil' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  }
  for (const path of ['/profil', '/admin']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Weiter ohne Konto' })).toBeVisible();
  }

  await open(page, '/katalog/01J9ZQ3W8D6V2K5M7N8P9R0AAA', 'Haferwurzel');
  const publication = page.getByTestId('publication');
  await expect(publication.getByRole('button', { name: 'Für alle vorschlagen' })).toHaveCount(0);
  await expect(publication).toContainText('um die Sorte für alle vorzuschlagen');
});

test('ending guest mode keeps or deletes the data, as chosen', async ({ page }) => {
  await signInAs(page, 'guest');
  await seedGuestGarden(page, {
    beds: [
      {
        id: '01J9ZQ3W8D6V2K5M7N8P9R0BED',
        name: 'Balkon',
        widthCm: 100,
        depthCm: 50,
        mainRowDirection: 'V',
        soilRenewals: [],
      },
    ],
    plantings: [],
  });
  await open(page, '/beete', 'Meine Beete');
  await expect(page.getByRole('article', { name: 'Balkon' })).toBeVisible();

  const end = async (choice: string) => {
    await page.getByRole('button', { name: 'Gastmodus beenden' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Gastmodus beenden?' });
    await confirm.getByRole('button', { name: choice }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  };

  await end('Daten behalten');
  await page.goto('/beete');
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  await page.getByRole('button', { name: 'Ohne Konto ausprobieren' }).click();
  await expect(page.getByRole('article', { name: 'Balkon' })).toBeVisible();

  await end('Daten löschen');
  expect((await storage(page)).guest).toBeNull();
  await page.getByRole('button', { name: 'Ohne Konto ausprobieren' }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Beete' })).toBeVisible();
});

test('signing in ends guest mode and shows the account, not the guest beds', async ({ page }) => {
  await signInAs(page, 'guest');
  await seedGuestGarden(page, {
    beds: [
      {
        id: '01J9ZQ3W8D6V2K5M7N8P9R0BED',
        name: 'Gastbeet',
        widthCm: 100,
        depthCm: 50,
        mainRowDirection: 'V',
        soilRenewals: [],
      },
    ],
    plantings: [],
  });
  await open(page, '/beete', 'Meine Beete');
  await page.getByTestId('guest-banner').getByRole('link', { name: 'Anmelden' }).click();
  await page.getByLabel('E-Mail').fill(USERS.user.email);
  await page.getByLabel('Passwort').fill(USERS.user.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Beete' })).toBeVisible();
  await expect(page.getByTestId('guest-banner')).toHaveCount(0);
  const stored = await storage(page);
  expect(stored.mode).toBeNull();
  // Kept for the import after sign-in (T-39).
  expect(stored.guest).toContain('Gastbeet');
});

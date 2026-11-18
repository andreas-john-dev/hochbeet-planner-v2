import type { Page } from '@playwright/test';
import { expect, open, signInAs, test, USERS } from './fixtures';
import { bed, GUEST_STORAGE_KEY, MOCK_API_KEY, seedGuestGarden } from './garden';

// Simple and expert view (T-73): new users and guests start simple, the choice sticks.

/** The view the mock API saved for the test user; switching shows it before it is saved. */
const savedView = (page: Page) =>
  page.evaluate(
    ([key, user]) =>
      (
        JSON.parse(localStorage.getItem(key) ?? '{}') as Record<
          string,
          { settings?: { view?: string } }
        >
      )[user]?.settings?.view,
    [MOCK_API_KEY, USERS.user.email] as const,
  );

/** The view in the guest's browser storage. */
const guestView = (page: Page) =>
  page.evaluate(
    (key) =>
      (
        JSON.parse(localStorage.getItem(key) ?? '{}') as {
          garden?: { settings?: { view?: string } };
        }
      ).garden?.settings?.view,
    GUEST_STORAGE_KEY,
  );

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' });
const sowingsLink = (page: Page) => nav(page).getByRole('link', { name: 'Anzucht' });

const profileOption = (page: Page, name: 'Einfach' | 'Experte') =>
  page
    .getByRole('group', { name: 'Ansicht' })
    .getByRole('button', { name: new RegExp(`^${name}`) });

/** The view switch in the editor: in the header on desktop, behind "Mehr" on phones. */
async function switchInEditor(page: Page, name: 'Einfach' | 'Experte', isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Mehr' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mehr' });
    await sheet.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await expect(sheet.getByRole('button', { name: new RegExp(`^${name}`) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  } else {
    const option = page
      .getByRole('group', { name: 'Einfach oder Experte' })
      .getByRole('button', { name });
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true');
  }
}

async function editorView(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Mehr' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mehr' });
    const pressed = sheet.getByRole('button', { pressed: true });
    const name = (await pressed.textContent()) ?? '';
    await page.keyboard.press('Escape');
    return name.startsWith('Experte') ? 'Experte' : 'Einfach';
  }
  return page
    .getByRole('group', { name: 'Einfach oder Experte' })
    .getByRole('button', { pressed: true })
    .textContent();
}

test('a new guest starts simple and keeps the expert view after a reload', async ({
  page,
  isMobile,
}) => {
  await open(page, '/anmelden', 'Anmelden');
  await page.getByRole('button', { name: 'Ohne Konto ausprobieren' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible();
  await expect(nav(page).getByRole('link', { name: 'Beete' })).toBeVisible();
  await expect(sowingsLink(page)).toHaveCount(0);
  // The page itself stays reachable, for existing links.
  await open(page, '/anzucht', 'Anzucht');

  await page.goto('/beete');
  await page.getByRole('button', { name: 'Erstes Beet anlegen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Beet anlegen' });
  await dialog.getByLabel('Name').fill('Gastbeet');
  await dialog.getByLabel('Breite (cm)').fill('120');
  await dialog.getByLabel('Tiefe (cm)').fill('80');
  await dialog.getByRole('button', { name: 'Beet anlegen' }).click();
  await page.getByRole('article', { name: 'Gastbeet' }).getByRole('link').first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gastbeet' })).toBeVisible();
  expect(await editorView(page, isMobile)).toBe('Einfach');

  await switchInEditor(page, 'Experte', isMobile);
  await expect(sowingsLink(page)).toBeVisible();
  await expect.poll(() => guestView(page)).toBe('EXPERT');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Gastbeet' })).toBeVisible();
  expect(await editorView(page, isMobile)).toBe('Experte');
  await expect(sowingsLink(page)).toBeVisible();
});

test('a guest with seeded beds starts in the expert view', async ({ page, isMobile }) => {
  await signInAs(page, 'guest');
  await seedGuestGarden(page, {
    beds: [bed('01J9ZQ3W8D6V2K5M7N8P9R0BED', 'Balkon', 100, 50)],
    plantings: [],
  });
  await open(page, '/beete/01J9ZQ3W8D6V2K5M7N8P9R0BED', 'Balkon');
  expect(await editorView(page, isMobile)).toBe('Experte');
  await switchInEditor(page, 'Einfach', isMobile);
  await expect(sowingsLink(page)).toHaveCount(0);
  await expect.poll(() => guestView(page)).toBe('SIMPLE');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Balkon' })).toBeVisible();
  expect(await editorView(page, isMobile)).toBe('Einfach');
});

test('a new user starts simple and the choice in the profile survives a reload', async ({
  page,
}) => {
  await signInAs(page, 'user', { view: null });
  await open(page, '/profil', 'Profil');
  await expect(profileOption(page, 'Einfach')).toHaveAttribute('aria-pressed', 'true');
  await expect(profileOption(page, 'Einfach')).toContainText(
    'Beet bepflanzen und Abstände und Nachbarn prüfen, ohne Zeitplanung.',
  );
  await expect(profileOption(page, 'Experte')).toContainText(
    'Mit Zeitachse, Fruchtfolge, Erde erneuern und Anzucht.',
  );
  await expect(sowingsLink(page)).toHaveCount(0);

  await profileOption(page, 'Experte').click();
  await expect(profileOption(page, 'Experte')).toHaveAttribute('aria-pressed', 'true');
  await expect(sowingsLink(page)).toBeVisible();
  await expect.poll(() => savedView(page)).toBe('EXPERT');
  await page.reload();
  await expect(profileOption(page, 'Experte')).toHaveAttribute('aria-pressed', 'true');

  await profileOption(page, 'Einfach').click();
  await expect.poll(() => savedView(page)).toBe('SIMPLE');
  await page.reload();
  await expect(profileOption(page, 'Einfach')).toHaveAttribute('aria-pressed', 'true');
  await expect(sowingsLink(page)).toHaveCount(0);
});

test('existing accounts are in the expert view; saving the last frost keeps it', async ({
  page,
}) => {
  await signInAs(page, 'user');
  await open(page, '/profil', 'Profil');
  await expect(profileOption(page, 'Experte')).toHaveAttribute('aria-pressed', 'true');
  await expect(sowingsLink(page)).toBeVisible();
  await page.getByLabel('Monat').selectOption({ label: 'April' });
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
  await page.reload();
  await expect(profileOption(page, 'Experte')).toHaveAttribute('aria-pressed', 'true');
});

test.describe('in English', () => {
  test.use({ language: 'en' });

  test('the profile names both views', async ({ page }) => {
    await signInAs(page, 'user');
    await open(page, '/profil', 'Profile');
    const group = page.getByRole('group', { name: 'View' });
    await expect(group.getByRole('button', { name: /^Expert/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(group.getByRole('button', { name: /^Simple/ })).toContainText(
      'Plant your bed and check spacing and neighbours, without planning over time.',
    );
  });
});

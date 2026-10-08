import { expect, open, signInAs, test } from './fixtures';
import { bed, planting, PLANTS, seedGarden } from './garden';

test.describe('bed overview', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'user');
  });

  test('invites to create the first bed', async ({ page }) => {
    await open(page, '/beete', 'Meine Beete');
    await expect(page.getByRole('heading', { name: 'Noch keine Beete' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Erstes Beet anlegen' })).toBeVisible();
  });

  test('creates, renames and deletes a bed', async ({ page }) => {
    await open(page, '/beete', 'Meine Beete');

    // Create
    await page.getByRole('button', { name: 'Erstes Beet anlegen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Beet anlegen' });
    await dialog.getByLabel('Name').fill('Hochbeet Süd');
    await dialog.getByLabel('Breite (cm)').fill('200');
    await dialog.getByLabel('Tiefe (cm)').fill('100');
    // Default: parallel to the shorter edge, i.e. parallel to the depth here.
    await expect(dialog.getByRole('radio', { name: /Parallel zur Tiefe/ })).toBeChecked();
    await dialog.getByRole('button', { name: 'Beet anlegen' }).click();
    await expect(dialog).toBeHidden();
    const card = page.getByRole('article', { name: 'Hochbeet Süd' });
    await expect(card).toContainText('200 × 100 cm · Reihen parallel zur Tiefe');

    // Rename
    await card.getByRole('button', { name: 'Beet „Hochbeet Süd“ bearbeiten' }).click();
    const edit = page.getByRole('dialog', { name: 'Beet bearbeiten' });
    await expect(edit.getByLabel('Name')).toHaveValue('Hochbeet Süd');
    await edit.getByLabel('Name').fill('Kräuterbeet');
    await edit.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('article', { name: 'Kräuterbeet' })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Hochbeet Süd' })).toHaveCount(0);

    // Survives a reload (mock API keeps its data in localStorage).
    await page.reload();
    await expect(page.getByRole('article', { name: 'Kräuterbeet' })).toBeVisible();

    // Delete with confirmation
    await page.getByRole('button', { name: 'Beet „Kräuterbeet“ löschen' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Beet „Kräuterbeet“ löschen?' });
    await expect(confirm).toContainText('Alle Pflanzungen dieses Beets werden ebenfalls gelöscht.');
    await confirm.getByRole('button', { name: 'Beet löschen' }).click();
    await expect(page.getByRole('heading', { name: 'Noch keine Beete' })).toBeVisible();
  });

  test('cancelling the delete keeps the bed', async ({ page }) => {
    await seedGarden(page, {
      beds: [bed('01J9ZQ3W8D6V2K5M7N8P9R0S1A', 'Bleibt', 120, 80)],
      plantings: [],
    });
    await open(page, '/beete', 'Meine Beete');
    await page.getByRole('button', { name: 'Beet „Bleibt“ löschen' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('article', { name: 'Bleibt' })).toBeVisible();
  });

  test('follows the default row direction until the user picks one', async ({ page }) => {
    await open(page, '/beete', 'Meine Beete');
    await page.getByRole('button', { name: 'Erstes Beet anlegen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Beet anlegen' });
    await dialog.getByLabel('Breite (cm)').fill('80');
    await dialog.getByLabel('Tiefe (cm)').fill('120');
    await expect(dialog.getByRole('radio', { name: /Parallel zur Breite/ })).toBeChecked();

    await dialog.getByRole('radio', { name: /Parallel zur Tiefe/ }).click();
    await dialog.getByLabel('Breite (cm)').fill('90');
    await expect(dialog.getByRole('radio', { name: /Parallel zur Tiefe/ })).toBeChecked();
  });

  test('shows German validation messages', async ({ page }) => {
    await open(page, '/beete', 'Meine Beete');
    await page.getByRole('button', { name: 'Erstes Beet anlegen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Beet anlegen' });
    await dialog.getByLabel('Breite (cm)').fill('203');
    await dialog.getByRole('button', { name: 'Beet anlegen' }).click();
    await expect(dialog.getByText('Bitte einen Namen angeben.')).toBeVisible();
    await expect(dialog.getByText('Muss ein Vielfaches von 5 cm sein.')).toBeVisible();
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`bed overview matches screenshot (${colorScheme})`, async ({ page }) => {
    await signInAs(page, 'user');
    const southId = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
    const herbsId = '01J9ZQ3W8D6V2K5M7N8P9R0S1B';
    await seedGarden(page, {
      beds: [
        bed(southId, 'Hochbeet Süd', 200, 100),
        bed(herbsId, 'Kräuterspirale', 120, 120),
        bed('01J9ZQ3W8D6V2K5M7N8P9R0S1C', 'Balkonkasten', 100, 30),
      ],
      plantings: [
        planting('01J9ZQ3W8D6V2K5M7N8P9R0S2A', southId, PLANTS.kale, { x: 40, y: 50 }),
        planting('01J9ZQ3W8D6V2K5M7N8P9R0S2B', southId, PLANTS.chard, {
          kind: 'ROW',
          x: 95,
          y: 30,
          orientation: 'H',
          lengthCm: 80,
          startDate: '2026-06-01',
        }),
        planting('01J9ZQ3W8D6V2K5M7N8P9R0S2C', herbsId, PLANTS.rosemary, { x: 60, y: 60 }),
      ],
    });
    await page.emulateMedia({ colorScheme });
    await open(page, '/beete', 'Meine Beete');
    await expect(page.getByRole('article')).toHaveCount(3);
    await expect(page.getByRole('article', { name: 'Hochbeet Süd' })).toContainText(
      '2 Pflanzungen in dieser Woche',
    );
    await expect(page).toHaveScreenshot(`beds-${colorScheme}.png`, { fullPage: true });
  });
}

import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { bed, planting, seedGarden } from './garden';

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const LETTUCE = '01M49THV00RK9E9PC83NEE87CJ'; // Kopfsalat, 25 cm in the row
const TOO_CLOSE = /Kopfsalat und Kopfsalat stehen zu eng/;

const findings = (page: Page) => page.getByRole('list', { name: 'Hinweise' });

test('searches and filters the catalogue', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/katalog', 'Pflanzenkatalog');
  const list = page.getByRole('list', { name: 'Sorten' });
  await expect(list.getByRole('listitem')).toHaveCount(56);

  await page.getByRole('searchbox', { name: 'Sorte oder Familie suchen' }).fill('salat');
  await expect(list.getByRole('link')).toHaveText([
    /^Feldsalat/,
    /^Kopfsalat/,
    /^Pflücksalat/,
    /^Salatgurke/,
  ]);
  await page.getByRole('button', { name: 'Starkzehrer' }).click();
  await expect(list.getByRole('link')).toHaveText([/^Salatgurke/]);
  await page.getByRole('button', { name: 'Starkzehrer' }).click();
  await page.getByRole('combobox', { name: 'Familie' }).selectOption('Korbblütler');
  await expect(list.getByRole('link')).toHaveText([/^Kopfsalat/, /^Pflücksalat/]);

  await page.getByRole('searchbox', { name: 'Sorte oder Familie suchen' }).fill('');
  await page.getByRole('combobox', { name: 'Familie' }).selectOption('');
  await page
    .getByRole('group', { name: 'Kategorie' })
    .getByRole('button', { name: 'Obst' })
    .click();
  await expect(list.getByRole('link').first()).toBeVisible();
  await page.getByRole('searchbox', { name: 'Sorte oder Familie suchen' }).fill('Tomate');
  await expect(page.getByText('Keine Sorte passt zu Suche und Filtern.')).toBeVisible();
});

test('shows all values and links to the neighbours', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/katalog', 'Pflanzenkatalog');
  await page.getByRole('link', { name: /^Kopfsalat/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kopfsalat' })).toBeVisible();
  await expect(page.getByText('Abstand in der Reihe')).toBeVisible();
  await expect(page.getByText('25 cm')).toBeVisible();
  await expect(page.getByText('8 Wochen')).toBeVisible();
  await expect(page).toHaveScreenshot('plant-details.png', { fullPage: true });

  const good = page.getByRole('list', { name: 'Gute Nachbarn' });
  const neighbor = good.getByRole('link').first();
  const name = (await neighbor.textContent()) ?? '';
  await neighbor.click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
});

test('an adjusted spacing changes the warnings in the editor and can be reset', async ({
  page,
}) => {
  await signInAs(page, 'user');
  // Two lettuces 30 cm apart: fine with 25 cm, too close with 60 cm.
  await seedGarden(page, {
    beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)],
    plantings: [
      planting('01J9ZQ3W8D6V2K5M7N8P9R0T01', BED_ID, LETTUCE, {
        x: 50,
        y: 50,
        startDate: '2026-10-05',
      }),
      planting('01J9ZQ3W8D6V2K5M7N8P9R0T02', BED_ID, LETTUCE, {
        x: 80,
        y: 50,
        startDate: '2026-10-05',
      }),
    ],
  });
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await expect(page.getByTestId('findings-summary')).toBeVisible();
  await expect(page.getByText(TOO_CLOSE)).toHaveCount(0);

  // Adjust Kopfsalat in the catalogue.
  await open(page, `/katalog/${LETTUCE}`, 'Kopfsalat');
  await page.getByRole('button', { name: 'Für mich anpassen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Kopfsalat für mich anpassen' });
  await dialog.getByLabel('Abstand in der Reihe').fill('60');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('angepasst (Standard: 25 cm)')).toBeVisible();
  await expect(page.getByText('Angepasst', { exact: true })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('plant-adjusted.png');

  // The editor now warns.
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await expect(findings(page)).toContainText(TOO_CLOSE);

  // Reset restores the global value and the warning disappears.
  await open(page, `/katalog/${LETTUCE}`, 'Kopfsalat');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await expect(page.getByRole('button', { name: 'Zurücksetzen' })).toBeHidden();
  await expect(page.getByText(/angepasst \(Standard/)).toHaveCount(0);
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await expect(page.getByTestId('findings-summary')).toBeVisible();
  await expect(page.getByText(TOO_CLOSE)).toHaveCount(0);
});

import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { bed, ownPlant, planting, seedGarden } from './garden';

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const LETTUCE = '01M49THV00RK9E9PC83NEE87CJ'; // Kopfsalat, 25 cm in the row
const TOO_CLOSE = /Kopfsalat und Kopfsalat stehen zu eng/;
const TOMATO = '01M49THV00QS1SEJEM64991JH5';
const CARROT = '01M49THV0022SSWEDY081PHP6T';
const STRAWBERRY = '01M49THV00W40ZTZ5PDDE1E2S8';
const OWN_ID = '01J9ZQ3W8D6V2K5M7N8P9R0W01';

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

test('shows the sowing calendar of a raised and a direct sown plant', async ({ page }) => {
  await signInAs(page, 'user');
  // The clock is fixed in 2026: 53 ISO weeks, 15 May is a Friday.
  await open(page, `/katalog/${TOMATO}`, 'Tomate');
  const calendar = page.getByRole('region', { name: 'Aussaatkalender' });
  const rows = calendar.getByRole('list', { name: 'Aussaatkalender 2026' }).getByRole('listitem');
  await expect(rows).toHaveText([
    /^Vorkultur:\s*KW 11–16 · Anfang März bis Mitte April$/,
    // Out after 7–13 weeks, but frost sensitive: not before the week after 15 May.
    /^Auspflanzen:\s*KW 21–29 · Mitte Mai bis Mitte Juli$/,
    /^Im Beet \/ Ernte:\s*KW 21–50 · Mitte Mai bis Mitte Dezember$/,
  ]);
  const plantOut = calendar.locator('[data-row="plantOut"] [data-from]');
  await expect(plantOut).toHaveAttribute('data-from', '21');
  await expect(plantOut).toHaveAttribute('data-to', '29');
  await expect(calendar).toContainText('7–13 Wochen bis zum Auspflanzen');
  await expect(calendar).toContainText('Frostempfindlich, erst nach dem 15. Mai ins Freie');

  await open(page, `/katalog/${CARROT}`, 'Möhre');
  await expect(rows).toHaveText([
    /^Direktsaat:\s*KW 10–29 · Anfang März bis Mitte Juli$/,
    /^Im Beet \/ Ernte:\s*KW 10–42 · Anfang März bis Mitte Oktober$/,
  ]);
  await expect(calendar).not.toContainText('Frostempfindlich');
});

test('explains a missing sowing calendar and links own plants to their form', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, { beds: [], plantings: [], ownPlants: [ownPlant(OWN_ID, 'Haferwurzel')] });
  await open(page, `/katalog/${STRAWBERRY}`, 'Erdbeere');
  const calendar = page.getByRole('region', { name: 'Aussaatkalender' });
  await expect(calendar).toContainText('noch keine Angaben zu Aussaat und Anzucht');
  await expect(calendar.getByRole('link')).toHaveCount(0);

  await open(page, `/katalog/${OWN_ID}`, 'Haferwurzel');
  await calendar.getByRole('link', { name: 'Angaben ergänzen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sorte bearbeiten' })).toBeVisible();
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
  // Closing the dialog can leave the page scrolled a little; the screenshot shows the top.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
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

for (const colorScheme of ['light', 'dark'] as const) {
  test(`catalogue matches screenshot (${colorScheme})`, async ({ page }) => {
    await signInAs(page, 'user');
    await page.emulateMedia({ colorScheme });
    await open(page, '/katalog', 'Pflanzenkatalog');
    await expect(page.getByText('56 Sorten')).toBeVisible();
    await expect(page).toHaveScreenshot(`catalog-${colorScheme}.png`);
  });
}

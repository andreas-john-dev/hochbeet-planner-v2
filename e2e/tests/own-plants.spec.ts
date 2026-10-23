import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { bed, ownPlant, seedGarden } from './garden';

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const ONION = '01M49THV006G34Z07ZJ8N4X0KS'; // Zwiebel
const REJECTED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0P01';
const LINKED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0P02';

/** Places a plant from the palette in the middle of the bed, by keyboard or by tap. */
async function plantInBed(page: Page, name: string, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Pflanze hinzufügen' }).tap();
    const sheet = page.getByRole('dialog', { name: 'Pflanze hinzufügen' });
    await sheet.getByRole('searchbox', { name: 'Sorte suchen' }).fill(name);
    await sheet.getByRole('button', { name }).tap();
    await page
      .getByRole('group', { name: 'Pflanze setzen' })
      .getByRole('button', { name: 'Hier pflanzen' })
      .tap();
  } else {
    const palette = page.getByRole('complementary', { name: 'Pflanzen hinzufügen' });
    await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill(name);
    await palette.getByRole('button', { name }).click();
    await page.keyboard.press('Enter');
  }
}

test('creates an own plant, uses it in a bed and asks for publication', async ({
  page,
  isMobile,
}) => {
  await signInAs(page, 'user');
  await seedGarden(page, { beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)], plantings: [] });
  await open(page, '/katalog', 'Pflanzenkatalog');
  await page.getByRole('link', { name: 'Eigene Sorte anlegen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eigene Sorte anlegen' })).toBeVisible();

  // Missing values are explained per field.
  await page.getByRole('button', { name: 'Sorte anlegen' }).click();
  await expect(page.getByText('Bitte gib einen Namen an.')).toBeVisible();

  await page.getByLabel('Name').fill('Haferwurzel');
  await expect(page.getByText('Bitte gib einen Namen an.')).toHaveCount(0);
  await page.getByLabel('Familie').fill('Korbblütler');
  await page.getByLabel('Bedarf').selectOption('SCHWACH');
  await page.getByLabel('Abstand in der Reihe (cm)').fill('10');
  await page.getByLabel('Reihenabstand (cm)').fill('25');
  await expect(page.getByText('Bleibt, bis du sie aus dem Beet entfernst')).toBeVisible();
  await page.getByLabel('Kulturdauer (Wochen)').fill('20');
  await page.getByTitle('Schwarzwurzel', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Schwarzwurzel' })).toBeChecked();
  await page.getByRole('searchbox', { name: 'Gute Nachbarn suchen' }).fill('Zwieb');
  await page.getByRole('button', { name: 'Zwiebel hinzufügen', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'Gute Nachbarn' }).getByRole('button', {
      name: 'Zwiebel entfernen',
    }),
  ).toBeVisible();
  // From the top, so the sticky phone header is where it belongs in the full-page image.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('own-plant-form.png', { fullPage: true });
  await page.getByRole('button', { name: 'Sorte anlegen' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Haferwurzel' })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').pop() ?? '';
  const status = page.getByTestId('publication');
  await expect(status).toHaveAttribute('data-state', 'private');
  await expect(page.getByText('Eigene Sorte')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Gute Nachbarn' })).toContainText('Zwiebel');

  // Use it in the bed.
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await plantInBed(page, 'Haferwurzel', isMobile);
  const planting = page.locator(`[data-testid^="planting-"][data-plant-id="${id}"]`);
  await expect(planting).toHaveCount(1);
  await page.reload();
  await expect(planting).toHaveCount(1);

  // Ask for publication.
  await open(page, `/katalog/${id}`, 'Haferwurzel');
  await page.getByRole('button', { name: 'Für alle vorschlagen' }).click();
  await expect(status).toHaveAttribute('data-state', 'pending');
  await expect(status.getByRole('heading')).toHaveText('Status: Angefragt');
  await expect(page.getByRole('button', { name: 'Für alle vorschlagen' })).toHaveCount(0);
  // The click may have scrolled the button into view on small screens; compare from the top.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await expect(page).toHaveScreenshot('own-plant-pending.png');
});

test('shows a rejection with comment and blocks own neighbours', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, {
    beds: [],
    plantings: [],
    ownPlants: [
      ownPlant(REJECTED_ID, 'Haferwurzel', {
        publication: {
          status: 'PRIVATE',
          rejectionComment: 'Bitte die Kulturdauer prüfen, eher 26 Wochen.',
        },
      }),
      ownPlant(LINKED_ID, 'Zuckerhut', { goodNeighbors: [REJECTED_ID, ONION] }),
    ],
  });

  await open(page, `/katalog/${REJECTED_ID}`, 'Haferwurzel');
  const status = page.getByTestId('publication');
  await expect(status).toHaveAttribute('data-state', 'rejected');
  await expect(status).toContainText('Bitte die Kulturdauer prüfen, eher 26 Wochen.');
  await expect(page.getByRole('button', { name: 'Erneut vorschlagen' })).toBeEnabled();

  // Editing keeps the status; the form starts with the stored values.
  await page.getByRole('link', { name: 'Bearbeiten' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sorte bearbeiten' })).toBeVisible();
  await page.getByLabel('Kulturdauer (Wochen)').fill('26');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Haferwurzel' })).toBeVisible();
  await expect(page.getByText('26 Wochen', { exact: true })).toBeVisible();
  await expect(status).toHaveAttribute('data-state', 'rejected');

  await open(page, `/katalog/${LINKED_ID}`, 'Zuckerhut');
  await expect(page.getByRole('button', { name: 'Für alle vorschlagen' })).toBeDisabled();
  await expect(page.getByText(/Entferne dafür zuerst Haferwurzel aus den Nachbarn/)).toBeVisible();
});

test('keeps sowing details of an own plant and changes them', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, { beds: [], plantings: [] });
  await open(page, '/katalog/neu', 'Eigene Sorte anlegen');
  await page.getByLabel('Name').fill('Ochsenherz');
  await page.getByLabel('Familie').fill('Nachtschattengewächse');
  await page.getByLabel('Abstand in der Reihe (cm)').fill('60');
  await page.getByLabel('Reihenabstand (cm)').fill('60');
  await page.getByLabel('Kulturdauer (Wochen)').fill('18');

  // The section starts collapsed for a new plant.
  await page.getByText('Aussaat & Anzucht').click();
  await page.getByRole('checkbox', { name: /Frostempfindlich/ }).check();
  await page.getByRole('radio', { name: /^Vorkultur Wird vorgezogen/ }).check();
  const presow = page.getByRole('group', { name: 'Vorkultur' });
  await presow.getByLabel('Aussaat ab KW').fill('10');
  await expect(presow.getByText('Anfang März')).toBeVisible();
  await presow.getByLabel('Aussaat bis KW').fill('14');
  await expect(presow.getByText('Anfang April')).toBeVisible();
  // Missing details are explained on the field.
  await page.getByRole('button', { name: 'Sorte anlegen' }).click();
  await expect(presow.getByText('Bitte die Dauer der Vorkultur angeben.')).toBeVisible();
  await presow.getByLabel('Vorkultur von (Wochen)').fill('6');
  await presow.getByLabel('Vorkultur bis (Wochen)').fill('8');
  await page.getByRole('button', { name: 'Sorte anlegen' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Ochsenherz' })).toBeVisible();
  const values = page.getByRole('region', { name: 'Werte' });
  await expect(values).toContainText('FrostempfindlichJa');
  await expect(values).toContainText('Vorkultur KW 10–14 (Anfang März bis Anfang April)');
  await expect(values).toContainText('6–8 Wochen bis zum Auspflanzen');

  // Editing starts with the stored details, open.
  await page.getByRole('link', { name: 'Bearbeiten' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sorte bearbeiten' })).toBeVisible();
  await expect(presow.getByLabel('Aussaat ab KW')).toHaveValue('10');
  await page.getByRole('radio', { name: /^Vorkultur oder Direktsaat/ }).check();
  const direct = page.getByRole('group', { name: 'Direktsaat' });
  await direct.getByLabel('Aussaat ab KW').fill('18');
  await direct.getByLabel('Aussaat bis KW').fill('22');
  await page.getByRole('button', { name: 'Speichern' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Ochsenherz' })).toBeVisible();
  await expect(values).toContainText('Vorkultur oder Direktsaat');
  await expect(values).toContainText('Direktsaat KW 18–22 (Ende April bis Ende Mai)');
  await page.reload();
  await expect(values).toContainText('Direktsaat KW 18–22');
});

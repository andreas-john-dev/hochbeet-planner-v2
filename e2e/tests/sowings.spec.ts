import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { seedGarden, seedGuestGarden, sowingsGarden } from './garden';

const card = (page: Page, name: string) => page.getByRole('article', { name });
const showing = (page: Page, label: string) =>
  page
    .getByRole('group', { name: 'Anzuchten zeigen' })
    .getByRole('button', { name: label })
    .click();

/** Fills „Neue Anzucht“ for the plant and saves; the week stays as given or the current one. */
async function createSowing(
  page: Page,
  plant: string,
  { sowDate, count, location }: { sowDate?: string; count: string; location?: string },
) {
  const dialog = page.getByRole('dialog', { name: 'Neue Anzucht' });
  await dialog.getByRole('searchbox', { name: 'Sorte suchen' }).fill(plant);
  await dialog.getByRole('radio', { name: new RegExp(plant) }).check();
  if (sowDate) await dialog.getByLabel('Aussaatwoche').fill(sowDate);
  await dialog.getByLabel('Gesäte Menge').fill(count);
  if (location) await dialog.getByLabel('Standort').fill(location);
  return dialog;
}

test('raises tomatoes from sowing to the end and deletes the batch', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/anzucht', 'Anzucht');
  await expect(page.getByRole('heading', { name: 'Noch keine Anzuchten' })).toBeVisible();
  await page.getByRole('button', { name: 'Erste Anzucht anlegen' }).click();

  const dialog = await createSowing(page, 'Tomate', {
    sowDate: '2026-02-04',
    count: '24',
    location: 'Fensterbank',
  });
  // A Wednesday becomes its Monday; tomatoes go out 13 weeks later, but not before the frost.
  await expect(dialog.getByLabel('Aussaatwoche')).toHaveValue('2026-02-02');
  await expect(dialog).toContainText('KW 6 · 2. – 8. Februar 2026');
  await expect(dialog.getByLabel('Geplantes Auspflanzen')).toHaveValue('2026-05-18');
  await expect(dialog).toContainText(
    'Aussaat plus 13 Wochen Vorkultur, frostempfindlich: nicht vor dem 15. Mai.',
  );
  await dialog.getByRole('button', { name: 'Anzucht anlegen' }).click();
  await expect(dialog).toBeHidden();

  const tomato = card(page, 'Tomate');
  await expect(tomato).toContainText('KW 6 · 2. – 8. Februar 2026');
  await expect(tomato).toContainText('Fensterbank');
  await expect(tomato).toContainText('Auspflanzen geplant: KW 21 · 18. – 24. Mai 2026');
  await expect(tomato.getByTestId('stock')).toHaveText('24 gesät');

  // Germinated: the stock starts at the sown amount and is then corrected.
  await tomato.getByRole('button', { name: 'Weiter: Gekeimt' }).click();
  await expect(tomato.getByTestId('stock')).toHaveText('lebend 24 · verplant 0 · frei 24');
  await expect(tomato).toContainText('24 von 24 gekeimt');
  const fewer = tomato.getByRole('button', { name: 'Bestand verringern' });
  await fewer.click();
  await expect(tomato).toContainText('23 von 24 gekeimt');
  await fewer.click();
  await expect(tomato).toContainText('22 von 24 gekeimt');
  await tomato.getByRole('button', { name: 'Bestand erhöhen' }).click();
  await expect(tomato.getByTestId('stock')).toHaveText('lebend 23 · verplant 0 · frei 23');

  await tomato.getByRole('button', { name: 'Weiter: Pikiert' }).click();
  await expect(tomato.getByRole('button', { name: 'Weiter: Abhärten' })).toBeVisible();

  // Completing empties the stock and moves the batch out of the active ones.
  await tomato.getByRole('button', { name: 'Abschließen' }).click();
  await expect(page.getByText('Gerade läuft keine Anzucht.')).toBeVisible();
  await showing(page, 'Abgeschlossen');
  await expect(tomato.getByTestId('stock')).toHaveText('lebend 0 · verplant 0 · frei 0');
  await expect(tomato.getByRole('button', { name: 'Abschließen' })).toHaveCount(0);

  await tomato.getByRole('button', { name: 'Tomate löschen' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Anzucht „Tomate“ löschen?' });
  await expect(confirm).toContainText('Aus dieser Anzucht steht noch nichts im Beet.');
  await confirm.getByRole('button', { name: 'Anzucht löschen' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Noch keine Anzuchten' })).toBeVisible();
});

test('counts seedlings planned into beds and names them before deleting', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, sowingsGarden);
  await open(page, '/anzucht', 'Anzucht');

  // Active batches of this year; the row of lettuce in the bed holds 3 plants.
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['2026']);
  const lettuce = card(page, 'Kopfsalat');
  await expect(lettuce.getByTestId('stock')).toHaveText('lebend 18 · verplant 3 · frei 15');
  await expect(card(page, 'Kohlrabi').getByTestId('stock')).toHaveText('12 gesät');

  await lettuce.getByRole('button', { name: 'Kopfsalat bearbeiten' }).click();
  const dialog = page.getByRole('dialog', { name: 'Anzucht bearbeiten' });
  await expect(dialog.getByRole('radio', { name: /Kopfsalat/ })).toBeChecked();
  await dialog.getByLabel('Bestand').fill('20');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
  await expect(lettuce.getByTestId('stock')).toHaveText('lebend 20 · verplant 3 · frei 17');

  await lettuce.getByRole('button', { name: 'Kopfsalat löschen' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Anzucht „Kopfsalat“ löschen?' });
  await expect(confirm).toContainText(
    '1 Pflanzung in „Hochbeet Süd“ stammt aus dieser Anzucht. Sie bleibt im Beet',
  );
  await confirm.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(lettuce).toBeVisible();

  // All batches: last year's peppers in their own group.
  await showing(page, 'Alle');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['2026', '2025']);
  await expect(card(page, 'Paprika')).toContainText('Abgeschlossen');
  await expect(card(page, 'Tomate')).toContainText('Zwei Pflanzen an die Nachbarn verschenkt.');
});

test('a guest raises kohlrabi and finds the batch after a reload', async ({ page }) => {
  await signInAs(page, 'guest');
  await seedGuestGarden(page, { beds: [], plantings: [] });
  await open(page, '/anzucht', 'Anzucht');
  await page.getByRole('button', { name: 'Erste Anzucht anlegen' }).click();
  const dialog = await createSowing(page, 'Kohlrabi', { count: '12' });
  // This week, KW 41: sown, and planted out 6 weeks later.
  await expect(dialog.getByLabel('Aussaatwoche')).toHaveValue('2026-10-05');
  await expect(dialog.getByLabel('Geplantes Auspflanzen')).toHaveValue('2026-11-16');
  await dialog.getByRole('button', { name: 'Anzucht anlegen' }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  const kohlrabi = card(page, 'Kohlrabi');
  await expect(kohlrabi).toContainText('KW 41 · 5. – 11. Oktober 2026');
  await expect(kohlrabi.getByTestId('stock')).toHaveText('12 gesät');
});

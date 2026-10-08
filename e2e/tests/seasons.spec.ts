import { expect, open, signInAs, test } from './fixtures';
import { bed, planting, seedGarden } from './garden';

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const KOHLRABI = '01M49THV007TNRTCQDEDDW9N6D'; // 9 weeks
const RADISH = '01M49THV00NAC3VGAMQF7XGNWF'; // 5 weeks

// Kohlrabi until 6 July, then radishes at the same place: both Kreuzblütler.
const garden = {
  beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)],
  plantings: [
    planting('01J9ZQ3W8D6V2K5M7N8P9R0T01', BED_ID, KOHLRABI, {
      x: 50,
      y: 50,
      startDate: '2026-05-04',
    }),
    planting('01J9ZQ3W8D6V2K5M7N8P9R0T02', BED_ID, RADISH, {
      x: 50,
      y: 50,
      startDate: '2026-07-06',
    }),
  ],
};

const ROTATION =
  'Radieschen folgt am selben Platz direkt auf Kohlrabi (beide Kreuzblütler) ohne Erneuerung der Erde.';

test('a soil renewal between two brassicas removes the crop rotation warning', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, garden);
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');

  const findings = page.getByRole('list', { name: 'Hinweise' });
  await expect(findings).toContainText(ROTATION);
  const marks = page.getByTestId('renewal-mark');
  await expect(marks).toHaveCount(1);
  await expect(marks).toHaveText('Erde erneuert am 1. März 2026');

  // Bed settings: the default is shown; an own date in July replaces it for 2026.
  await page.getByRole('button', { name: 'Beet bearbeiten' }).click();
  const dialog = page.getByRole('dialog', { name: 'Beet bearbeiten' });
  const years = dialog.getByRole('list', { name: 'Erneuerungen je Jahr' });
  await expect(years.getByRole('listitem').filter({ hasText: '2026' })).toHaveText(
    /1\. März 2026 \(Standard\)/,
  );
  await dialog.getByRole('button', { name: 'Erneuerung hinzufügen' }).click();
  await dialog.getByLabel('Erneuerung 1', { exact: true }).fill('2026-07-06');
  await expect(years.getByRole('listitem').filter({ hasText: '2026' })).toHaveText(
    /6\. Juli 2026$/,
  );
  await expect(dialog).toHaveScreenshot('bed-settings-renewals.png');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();

  await expect(findings.getByText(ROTATION)).toHaveCount(0);
  await expect(page.getByTestId('findings-summary')).toHaveText('Keine Warnungen');
  await expect(marks).toHaveText('Erde erneuert am 6. Juli 2026');

  // Still there after a reload.
  await page.reload();
  await expect(page.getByTestId('renewal-mark')).toHaveText('Erde erneuert am 6. Juli 2026');
  await expect(page.getByTestId('findings-summary')).toHaveText('Keine Warnungen');
});

test('keeps the default as an own date and rejects duplicates', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, garden);
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await page.getByRole('button', { name: 'Beet bearbeiten' }).click();
  const dialog = page.getByRole('dialog', { name: 'Beet bearbeiten' });

  // "Anpassen" takes over 1 March as an own date, then a second one is added.
  await dialog.getByRole('button', { name: 'Erneuerung 2026 anpassen' }).click();
  await expect(dialog.getByLabel('Erneuerung 1', { exact: true })).toHaveValue('2026-03-01');
  await dialog.getByRole('button', { name: 'Erneuerung hinzufügen' }).click();
  await dialog.getByLabel('Erneuerung 2', { exact: true }).fill('2026-03-01');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Ein Datum steht doppelt in der Liste.');

  await dialog.getByLabel('Erneuerung 2', { exact: true }).fill('2026-07-06');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
  // Both season boundaries of 2026 are on the slider; the warning is gone.
  await expect(page.getByTestId('renewal-mark')).toHaveText([
    'Erde erneuert am 1. März 2026',
    'Erde erneuert am 6. Juli 2026',
  ]);
  await expect(page.getByRole('list', { name: 'Hinweise' }).getByText(ROTATION)).toHaveCount(0);
});

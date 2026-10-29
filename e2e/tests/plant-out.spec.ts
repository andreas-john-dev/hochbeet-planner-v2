import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { bed, PLANTS, planting, seedGarden, sowing, sowingId } from './garden';

const BED_A = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const BED_B = '01J9ZQ3W8D6V2K5M7N8P9R0S1B';
const LETTUCE_BATCH = sowingId(1);

/** Rows run along the 200 cm width, so a row of 6 lettuces (125 cm) fits. */
const across = (id: string, name: string) => ({
  ...bed(id, name, 200, 100),
  mainRowDirection: 'H',
});

/** 24 lettuces sown in KW 38, 18 alive and hardening off on 7 October 2026. */
const lettuceBatch = sowing(LETTUCE_BATCH, PLANTS.lettuce, {
  sowDate: '2026-09-14',
  sownCount: 24,
  aliveCount: 18,
  stage: 'HARDENING',
});

const lettuces = (page: Page) => page.locator(`[data-plant-id="${PLANTS.lettuce}"]`);
const offered = (page: Page) =>
  page.getByRole('list', { name: 'Anzuchten' }).getByRole('button', { name: /Kopfsalat/ });

/** Screen point of a bed position in cm, from the drawn bed outline (200 cm wide). */
async function screenPoint(page: Page, cm: { x: number; y: number }) {
  const box = await page.getByTestId('bed-grid').boundingBox();
  if (!box) throw new Error('bed not drawn');
  const pxPerCm = box.width / 200;
  return { x: box.x + cm.x * pxPerCm, y: box.y + cm.y * pxPerCm };
}

async function dragTo(page: Page, from: ReturnType<Page['locator']>, to: { x: number; y: number }) {
  const box = await from.boundingBox();
  if (!box) throw new Error('not visible');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 10, start.y, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

test.describe('planting out from a sowing batch on the desktop', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'Drag & drop and keyboard placement are desktop features.');
  });

  test('plants 6 of 18 lettuces as a row, undoes it and unlinks the planting', async ({ page }) => {
    await signInAs(page, 'user');
    await seedGarden(page, {
      beds: [across(BED_A, 'Hochbeet Süd')],
      plantings: [],
      sowings: [lettuceBatch],
    });
    await open(page, `/beete/${BED_A}`, 'Hochbeet Süd');
    await expect(offered(page)).toContainText('KW 38 · 18 frei');

    await dragTo(page, offered(page), await screenPoint(page, { x: 41, y: 52 }));
    const dialog = page.getByRole('dialog', { name: 'Kopfsalat auspflanzen' });
    await expect(dialog).toContainText('Aus der Anzucht vom 14. – 20. September 2026, 18 frei.');
    await expect(dialog.getByLabel('Wie viele?')).toHaveValue('18');
    await dialog.getByLabel('Wie viele?').fill('6');
    await dialog.getByRole('radio', { name: 'Als Reihe' }).check();
    await expect(dialog).toContainText('Reihe von 125 cm mit 6 Pflanzen, 25 cm Abstand.');
    await dialog.getByRole('button', { name: 'Auspflanzen' }).click();
    await expect(dialog).toBeHidden();

    const row = lettuces(page);
    await expect(row).toHaveAttribute('data-testid', /^planting-[0-9A-Z]{26}$/);
    await expect(row).toHaveAttribute('data-kind', 'ROW');
    await expect(row).toHaveAttribute('data-x', '40');
    await expect(row).toHaveAttribute('data-length-cm', '125');
    // A new row is selected for its length handle; the panel names where it comes from.
    const panel = page.getByRole('complementary', { name: 'Pflanzung Kopfsalat' });
    await expect(panel.getByTestId('sowing-origin')).toHaveText(
      'Aus der Anzucht vom 14. – 20. September 2026, 6 von 18. Zur Anzucht',
    );
    await panel.getByRole('button', { name: 'Auswahl aufheben' }).click();
    await expect(offered(page)).toContainText('12 frei');

    // One undo takes the row back, and all 18 are free again.
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(row).toHaveCount(0);
    await expect(offered(page)).toContainText('18 frei');
    // Redo brings the row back, selected again; choosing no batch frees the seedlings.
    await page.getByRole('button', { name: 'Wiederholen' }).click();
    await expect(row).toHaveAttribute('data-testid', /^planting-[0-9A-Z]{26}$/);
    await expect(panel.getByTestId('sowing-origin')).toBeVisible();
    await panel.getByLabel('Aus der Anzucht').selectOption({ label: 'Keine (z. B. gekauft)' });
    await expect(panel.getByTestId('sowing-origin')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Auswahl aufheben' }).click();
    await expect(offered(page)).toContainText('18 frei');
  });

  test('plants the rest as single plants into a second bed', async ({ page }) => {
    await signInAs(page, 'user');
    await seedGarden(page, {
      beds: [across(BED_A, 'Hochbeet Süd'), across(BED_B, 'Hochbeet Nord')],
      plantings: [
        planting('01J9ZQ3W8D6V2K5M7N8P9R0PA1', BED_A, PLANTS.lettuce, {
          kind: 'ROW',
          orientation: 'H',
          lengthCm: 125,
          x: 40,
          y: 50,
          startDate: '2026-10-05',
          sowingId: LETTUCE_BATCH,
        }),
      ],
      sowings: [lettuceBatch],
    });
    await open(page, `/beete/${BED_B}`, 'Hochbeet Nord');
    await expect(offered(page)).toContainText('12 frei');

    // Keyboard: pick the batch, move the cursor to the top left corner, place.
    await offered(page).focus();
    await page.keyboard.press('Enter');
    for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp']) {
      await page.keyboard.press(`Shift+${key}`);
    }
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Kopfsalat auspflanzen' });
    await expect(dialog.getByLabel('Wie viele?')).toHaveValue('12');
    await dialog.getByRole('radio', { name: 'Als Einzelpflanzen' }).check();
    await expect(dialog).toContainText('12 Einzelpflanzen im Abstand von 25 cm');
    await dialog.getByRole('button', { name: 'Auspflanzen' }).click();

    // 9 fit along the 200 cm row from x = 0, the other 3 start a second row 30 cm further.
    await expect(lettuces(page)).toHaveCount(12);
    await expect(lettuces(page).and(page.locator('[data-y="30"]'))).toHaveCount(3);
    await expect(offered(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(lettuces(page)).toHaveCount(0);
    await expect(offered(page)).toContainText('12 frei');
  });
});

test('plants out from the bottom sheet on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phones only.');
  await signInAs(page, 'user');
  await seedGarden(page, {
    beds: [bed(BED_A, 'Hochbeet Süd', 200, 100)],
    plantings: [],
    sowings: [lettuceBatch],
  });
  await open(page, `/beete/${BED_A}`, 'Hochbeet Süd');

  await page.getByRole('button', { name: 'Pflanze hinzufügen' }).tap();
  const palette = page.getByRole('dialog', { name: 'Pflanze hinzufügen' });
  await palette
    .getByRole('list', { name: 'Anzuchten' })
    .getByRole('button', { name: /Kopfsalat/ })
    .tap();
  await expect(palette).toBeHidden();
  await page
    .getByRole('group', { name: 'Pflanze setzen' })
    .getByRole('button', { name: 'Hier pflanzen' })
    .tap();

  const sheet = page.getByRole('dialog', { name: 'Kopfsalat auspflanzen' });
  await sheet.getByLabel('Wie viele?').fill('2');
  await sheet.getByRole('radio', { name: 'Als Einzelpflanzen' }).check();
  await sheet.getByRole('button', { name: 'Auspflanzen' }).tap();
  await expect(sheet).toBeHidden();
  // From the bed centre along the depth (main row direction): 50 and 75 cm.
  await expect(lettuces(page)).toHaveCount(2);
  await expect(lettuces(page).and(page.locator('[data-y="75"]'))).toHaveCount(1);
});

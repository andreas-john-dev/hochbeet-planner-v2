import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { bed, seedGarden } from './garden';

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const TOMATO = '01M49THV00QS1SEJEM64991JH5';
const CARROT = '01M49THV0022SSWEDY081PHP6T';
const LETTUCE = '01M49THV00RK9E9PC83NEE87CJ';

/** Screen point of a bed position in cm, from the drawn bed outline. */
async function screenPoint(page: Page, cm: { x: number; y: number }) {
  const box = await page.getByTestId('bed-grid').boundingBox();
  if (!box) throw new Error('bed not drawn');
  const pxPerCm = box.width / 200;
  return { x: box.x + cm.x * pxPerCm, y: box.y + cm.y * pxPerCm };
}

async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

async function center(page: Page, locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('adding plants on the desktop', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'The palette is a desktop sidebar; phones get a bottom sheet (T-27).');
    await signInAs(page, 'user');
    await seedGarden(page, { beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)], plantings: [] });
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  });

  test('drags a tomato and a 1 m carrot row into the bed and finds them after a reload', async ({
    page,
  }) => {
    const palette = page.getByRole('complementary', { name: 'Pflanzen hinzufügen' });
    const plantings = page.locator('[data-testid^="planting-"]');

    // Tomato as a single plant.
    await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill('Tomate');
    await dragTo(
      page,
      await center(page, palette.getByRole('button', { name: 'Tomate' })),
      await screenPoint(page, { x: 41, y: 52 }),
    );
    const tomato = plantings.and(page.locator(`[data-plant-id="${TOMATO}"]`));
    await expect(tomato).toHaveAttribute('data-kind', 'SINGLE');
    await expect(tomato).toHaveAttribute('data-x', '40');
    await expect(tomato).toHaveAttribute('data-y', '50');

    // Carrots as a row, prefilled along the depth (main row direction), then drawn to 1 m.
    await palette.getByRole('button', { name: 'Reihe' }).click();
    await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill('Möhre');
    await dragTo(
      page,
      await center(page, palette.getByRole('button', { name: 'Möhre' })),
      await screenPoint(page, { x: 120, y: 0 }),
    );
    const carrots = plantings.and(page.locator(`[data-plant-id="${CARROT}"]`));
    await expect(carrots).toHaveAttribute('data-kind', 'ROW');
    await expect(carrots).toHaveAttribute('data-length-cm', '50');
    const handle = page.getByRole('slider', { name: 'Länge der Reihe Möhre' });
    await expect(handle).toHaveAttribute('aria-valuenow', '50');
    await dragTo(page, await center(page, handle), await screenPoint(page, { x: 121, y: 99 }));
    await expect(carrots).toHaveAttribute('data-length-cm', '100');
    await expect(page.getByTestId('bed-canvas')).toHaveScreenshot('row-selected.png');

    await page.reload();
    await expect(plantings).toHaveCount(2);
    await expect(tomato).toHaveAttribute('data-x', '40');
    await expect(carrots).toHaveAttribute('data-x', '120');
    await expect(carrots).toHaveAttribute('data-y', '0');
    await expect(carrots).toHaveAttribute('data-length-cm', '100');
    // The row touches the bed edge, so its name also carries the hint.
    await expect(carrots).toHaveAccessibleName(/^Möhre, Reihe mit 26 Pflanzen/);
  });

  test('places a plant with the keyboard', async ({ page }) => {
    const palette = page.getByRole('complementary', { name: 'Pflanzen hinzufügen' });
    await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill('tom');
    await palette.getByRole('button', { name: 'Tomate' }).focus();
    await page.keyboard.press('Enter');

    const canvas = page.getByTestId('bed-canvas');
    await expect(canvas).toBeFocused();
    const preview = page.getByTestId('placement-preview');
    await expect(preview).toHaveAttribute('data-x', '100');
    await expect(preview).toHaveAttribute('data-y', '50');

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Shift+ArrowUp');
    await expect(page.getByText(/Tomate als Einzelpflanze bei 90 × 25 cm/)).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(preview).toHaveCount(0);
    const tomato = page.locator(`[data-plant-id="${TOMATO}"]`);
    await expect(tomato).toHaveAttribute('data-x', '90');
    await expect(tomato).toHaveAttribute('data-y', '25');

    // Escape cancels a placement without adding anything.
    await palette.getByRole('button', { name: 'Tomate' }).focus();
    await page.keyboard.press('Enter');
    await expect(preview).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(preview).toHaveCount(0);
    await expect(tomato).toHaveCount(1);
  });

  test('sows carrots directly and switches lettuce between planted and sown', async ({ page }) => {
    const palette = page.getByRole('complementary', { name: 'Pflanzen hinzufügen' });
    const place = async (name: string, plantId: string) => {
      await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill(name);
      await palette.getByRole('button', { name }).focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press(name === 'Möhre' ? 'Shift+ArrowLeft' : 'Shift+ArrowRight');
      await page.keyboard.press('Enter');
      // Changes wait until the server has created the planting (temporary id until then).
      const planting = page.locator(`[data-plant-id="${plantId}"]`);
      await expect(planting).toHaveAttribute('data-testid', /^planting-[0-9A-Z]{26}$/);
      await planting.click();
      return page.getByRole('complementary', { name: `Pflanzung ${name}` });
    };

    // Carrots are only sown directly: they start as direct sowing. 14 weeks from KW 41.
    const carrots = await place('Möhre', CARROT);
    await expect(carrots.getByRole('radio', { name: 'Direktsaat' })).toBeChecked();
    await expect(carrots).toContainText('Gesät');
    await expect(carrots).toContainText('Mo., 11. Januar 2027 (KW 2)aus der Standzeit');
    await carrots.getByRole('button', { name: 'Auswahl aufheben' }).click();

    // Lettuce is usually planted out: 8 weeks, sown directly 3 weeks more.
    const lettuce = await place('Kopfsalat', LETTUCE);
    const planted = lettuce.getByRole('radio', { name: 'Gepflanzt' });
    const sown = lettuce.getByRole('radio', { name: 'Direktsaat' });
    await expect(planted).toBeChecked();
    await expect(lettuce).toContainText('Bei Direktsaat 3 Wochen länger im Beet.');
    await expect(lettuce).toContainText('Mo., 30. November 2026 (KW 49)aus der Standzeit');
    await expect(lettuce.getByLabel('Ende anpassen')).toHaveValue('2026-11-30');

    // The radio follows the optimistic update, which lands a moment after the click
    // (`onMutate` cancels running bed queries first), so wait instead of `check()`.
    await sown.click();
    await expect(sown).toBeChecked();
    await expect(sown).toBeFocused();
    await expect(lettuce).toContainText('Mo., 21. Dezember 2026 (KW 52)aus der Standzeit');
    await expect(lettuce.getByLabel('Ende anpassen')).toHaveValue('2026-12-21');

    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(planted).toBeChecked();
    await expect(lettuce).toContainText('Mo., 30. November 2026 (KW 49)aus der Standzeit');

    await page.getByRole('button', { name: 'Wiederholen' }).click();
    await expect(sown).toBeChecked();
    await page.reload();
    await page.locator(`[data-plant-id="${LETTUCE}"]`).click();
    await expect(
      page
        .getByRole('complementary', { name: 'Pflanzung Kopfsalat' })
        .getByRole('radio', { name: 'Direktsaat' }),
    ).toBeChecked();
  });

  test('filters the palette by category', async ({ page }) => {
    const palette = page.getByRole('complementary', { name: 'Pflanzen hinzufügen' });
    const list = palette.getByRole('list', { name: 'Sorten' });
    await palette.getByRole('button', { name: 'Obst' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(list.getByRole('button', { name: 'Erdbeere' })).toBeVisible();
    await palette.getByRole('button', { name: 'Kräuter' }).click();
    await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill('gurke');
    await expect(palette.getByText('Keine Sorte gefunden.')).toBeVisible();
  });
});

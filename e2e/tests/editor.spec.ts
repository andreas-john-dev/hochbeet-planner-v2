import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { EXAMPLE_BED_ID, exampleGarden, exampleId, seedGarden } from './garden';

const BED_ID = EXAMPLE_BED_ID;
const example = exampleGarden;
const id = exampleId;

const canvas = (page: Page) => page.getByTestId('bed-canvas');
const scaleOf = async (page: Page) => Number(await canvas(page).getAttribute('data-scale'));

test.describe('bed editor', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'user');
    await seedGarden(page, example);
  });

  test('opens from the bed card and shows every planting', async ({ page }) => {
    await open(page, '/beete', 'Meine Beete');
    await page.getByRole('link', { name: 'Hochbeet Süd' }).click();
    await expect(page).toHaveURL(`/beete/${BED_ID}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Hochbeet Süd' })).toBeVisible();
    await expect(page.getByText('200 × 100 cm')).toBeVisible();

    await expect(page.locator('[data-testid^="planting-"]')).toHaveCount(8);
    for (let n = 1; n <= 8; n++) await expect(page.getByTestId(`planting-${id(n)}`)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Rote Bete, Reihe mit 9 Pflanzen' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Alle Beete' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible();
  });

  test('zooms with the buttons and fits back to the bed', async ({ page }) => {
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
    await expect(canvas(page)).toBeVisible();
    const fitted = await scaleOf(page);
    expect(fitted).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Vergrößern' }).click();
    await expect.poll(() => scaleOf(page)).toBeCloseTo(fitted * 1.4, 3);
    await page.getByRole('button', { name: 'Vergrößern' }).click();
    // Finer grid when zoomed in.
    const grid = page.getByTestId('bed-grid');
    const zoomedStep = Number(await grid.getAttribute('data-grid-step'));

    await page.getByRole('button', { name: 'Verkleinern' }).click();
    await page.getByRole('button', { name: 'Verkleinern' }).click();
    await page.getByRole('button', { name: 'Verkleinern' }).click();
    await expect.poll(() => scaleOf(page)).toBeLessThan(fitted);
    expect(Number(await grid.getAttribute('data-grid-step'))).toBeGreaterThanOrEqual(zoomedStep);

    await page.getByRole('button', { name: 'Auf Beet einpassen' }).click();
    await expect.poll(() => scaleOf(page)).toBeCloseTo(fitted, 3);
  });

  test('zooms with the mouse wheel and pans by dragging', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Mouse wheel and drag are desktop gestures');
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
    const fitted = await scaleOf(page);
    const box = await canvas(page).boundingBox();
    if (!box) throw new Error('canvas not rendered');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await expect.poll(() => scaleOf(page)).toBeGreaterThan(fitted);

    const kale = page.getByTestId(`planting-${id(4)}`);
    const before = await kale.boundingBox();
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    const after = await kale.boundingBox();
    expect(after && before && after.x - before.x).toBeCloseTo(80, 0);
  });

  test('shows a message for an unknown bed', async ({ page }) => {
    await page.goto('/beete/01J9ZQ3W8D6V2K5M7N8P9R0S9Z');
    await expect(page.getByRole('heading', { name: 'Beet nicht gefunden' })).toBeVisible();
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`bed editor matches screenshot (${colorScheme})`, async ({ page }) => {
    await signInAs(page, 'user');
    await seedGarden(page, example);
    await page.emulateMedia({ colorScheme });
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
    await expect(page.locator('[data-testid^="planting-"]')).toHaveCount(8);
    await expect(canvas(page)).toBeVisible();
    await expect(page).toHaveScreenshot(`editor-${colorScheme}.png`, { fullPage: true });
  });
}

import type { Locator, Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { bed, planting, PLANTS, seedGarden } from './garden';

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const KALE_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T01';
const TOMATO = '01M49THV00QS1SEJEM64991JH5';

const garden = {
  beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)],
  plantings: [planting(KALE_ID, BED_ID, PLANTS.kale, { x: 40, y: 50 })],
};

/** Screen point of a bed position in cm, from the drawn bed outline (200 cm wide). */
async function screenPoint(page: Page, cm: { x: number; y: number }) {
  const box = await page.getByTestId('bed-grid').boundingBox();
  if (!box) throw new Error('bed not drawn');
  const pxPerCm = box.width / 200;
  return { x: box.x + cm.x * pxPerCm, y: box.y + cm.y * pxPerCm };
}

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * One finger: down at `from`, hold for `holdMs`, move to `to` and lift. Every event carries
 * the time it happened, as on a real touchscreen, so a busy test machine that delivers the
 * events late does not turn a quick swipe into a long press.
 */
async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  holdMs: number,
) {
  const cdp = await page.context().newCDPSession(page);
  const start = Date.now();
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    x: number,
    y: number,
    atMs: number,
  ) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
      timestamp: (start + atMs) / 1000,
    });
  await touch('touchStart', from.x, from.y, 0);
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  const moveAt = Math.max(holdMs, Date.now() - start);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await touch(
      'touchMove',
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
      // A swipe moves right away; after a hold, the moves follow in real time.
      holdMs > 0 ? moveAt + i * 16 : i * 16,
    );
  }
  await touch('touchEnd', to.x, to.y, (holdMs > 0 ? moveAt : 0) + (steps + 1) * 16);
  await cdp.detach();
}

test.describe('editor on the phone', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch interaction on phones; the desktop has its own tests.');
    await signInAs(page, 'user');
    await seedGarden(page, garden);
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  });

  test('places a plant by tap and confirms the preview', async ({ page }) => {
    await page.getByRole('button', { name: 'Pflanze hinzufügen' }).tap();
    const sheet = page.getByRole('dialog', { name: 'Pflanze hinzufügen' });
    await expect(sheet.getByRole('button', { name: 'Aubergine' })).toBeVisible();
    await expect(page).toHaveScreenshot('palette-sheet.png');
    await sheet.getByRole('searchbox', { name: 'Sorte suchen' }).fill('Tomate');
    await sheet.getByRole('button', { name: 'Tomate' }).tap();
    await expect(sheet).toBeHidden();

    const preview = page.getByTestId('placement-preview');
    await expect(preview).toBeVisible();
    const at = await screenPoint(page, { x: 151, y: 29 });
    await page.touchscreen.tap(at.x, at.y);
    await expect(preview).toHaveAttribute('data-x', '150');
    await expect(preview).toHaveAttribute('data-y', '30');
    await expect(page).toHaveScreenshot('tap-to-place.png');
    // A tap only moves the preview; nothing is planted before the confirmation.
    await expect(page.locator(`[data-plant-id="${TOMATO}"]`)).toHaveCount(1);

    await page
      .getByRole('group', { name: 'Pflanze setzen' })
      .getByRole('button', {
        name: 'Hier pflanzen',
      })
      .tap();
    await expect(preview).toHaveCount(0);
    const tomato = page.getByTestId('bed-canvas').getByRole('button', { name: 'Tomate' });
    await expect(tomato).toHaveAttribute('data-x', '150');

    await page.reload();
    await expect(tomato).toHaveAttribute('data-y', '30');
  });

  test('moves a planting after a long press; a quick swipe pans instead', async ({ page }) => {
    const kale = page.getByTestId(`planting-${KALE_ID}`);
    const canvas = page.getByTestId('bed-canvas');
    const scale =
      (await screenPoint(page, { x: 1, y: 0 })).x - (await screenPoint(page, { x: 0, y: 0 })).x;

    // Swipe without holding: the view pans, the planting stays where it is in the bed.
    const before = await center(kale);
    await touchDrag(page, before, { x: before.x + 40, y: before.y }, 0);
    await expect(kale).toHaveAttribute('data-x', '40');
    await expect.poll(async () => (await center(kale)).x).toBeGreaterThan(before.x + 20);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Hold longer than our 200 ms and Chromium's own 500 ms long press (which the bed
    // suppresses, otherwise Android swallows the next tap), then drag 30 cm to the right.
    const from = await center(kale);
    await touchDrag(page, from, { x: from.x + 30 * scale, y: from.y }, 800);
    await expect(kale).toHaveAttribute('data-x', '70');
    await expect(kale).toHaveAttribute('data-y', '50');
    // Moving does not open the detail sheet.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(canvas).toBeVisible();

    const undo = page.getByRole('button', { name: 'Rückgängig' });
    await expect(undo).toBeEnabled();
    await undo.tap();
    await expect(kale).toHaveAttribute('data-x', '40');
  });

  test('opens details as a bottom sheet with large touch targets', async ({ page }) => {
    await page.getByTestId(`planting-${KALE_ID}`).tap();
    const sheet = page.getByRole('dialog', { name: 'Pflanzung Grünkohl' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Einzelpflanze');

    for (const target of await sheet.getByRole('button').all()) {
      const box = await target.boundingBox();
      expect(box?.height, await target.innerText()).toBeGreaterThanOrEqual(44);
    }
    await expect(page).toHaveScreenshot('details-sheet.png');

    await sheet.getByRole('button', { name: 'Auswahl aufheben' }).tap();
    await expect(sheet).toBeHidden();
  });

  test('double tap does not zoom the page', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1, name: 'Hochbeet Süd' });
    const at = await center(heading);
    await page.touchscreen.tap(at.x, at.y);
    await page.touchscreen.tap(at.x, at.y);
    const canvas = await center(page.getByTestId('bed-canvas'));
    await page.touchscreen.tap(canvas.x, canvas.y);
    await page.touchscreen.tap(canvas.x, canvas.y);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe(
      'manipulation',
    );
  });
});

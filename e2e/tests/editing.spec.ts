import type { Locator, Page } from '@playwright/test';
import { expect, open, signInAs, test, USERS } from './fixtures';
import { bed, planting, PLANTS, seedGarden } from './garden';

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const TOMATO = '01M49THV00QS1SEJEM64991JH5'; // Tomate, 22 weeks
const KALE_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T01';
const TOMATO_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T02';
const CARROT_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T03';

const garden = {
  beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)],
  plantings: [
    planting(KALE_ID, BED_ID, PLANTS.kale, { x: 40, y: 50 }),
    planting(TOMATO_ID, BED_ID, TOMATO, { x: 120, y: 50, startDate: '2026-08-03' }),
    planting(CARROT_ID, BED_ID, '01M49THV0022SSWEDY081PHP6T', {
      kind: 'ROW',
      x: 175,
      y: 10,
      orientation: 'V',
      lengthCm: 60,
      startDate: '2026-09-07',
    }),
  ],
};

/** Planting as stored by the mock API. */
async function stored(page: Page, id: string) {
  return page.evaluate(
    ([user, plantingId]) => {
      const data = JSON.parse(localStorage.getItem('hochbeet-mock-api') ?? '{}') as Record<
        string,
        { plantings: { id: string }[] }
      >;
      return data[user]?.plantings.find((p) => p.id === plantingId) ?? null;
    },
    [USERS.user.email, id] as const,
  );
}

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** px per cm, from the drawn bed outline (200 cm wide). */
async function pxPerCm(page: Page) {
  const box = await page.getByTestId('bed-grid').boundingBox();
  if (!box) throw new Error('bed not drawn');
  return box.width / 200;
}

test.describe('editing plantings', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'user');
    await seedGarden(page, garden);
  });

  test('moves a planting, undoes and redoes it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Moving by touch needs a long press (T-27).');
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
    const kale = page.getByTestId(`planting-${KALE_ID}`);
    const undo = page.getByRole('button', { name: 'Rückgängig' });
    const redo = page.getByRole('button', { name: 'Wiederholen' });
    await expect(undo).toBeDisabled();

    // Drag 30 cm to the right and 10 cm down.
    const from = await center(kale);
    const scale = await pxPerCm(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 30 * scale, from.y + 10 * scale, { steps: 8 });
    await page.mouse.up();
    await expect(kale).toHaveAttribute('data-x', '70');
    await expect(kale).toHaveAttribute('data-y', '60');
    await expect(kale).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => stored(page, KALE_ID)).toMatchObject({ x: 70, y: 60 });

    await undo.click();
    await expect(kale).toHaveAttribute('data-x', '40');
    await expect.poll(() => stored(page, KALE_ID)).toMatchObject({ x: 40, y: 50 });
    await expect(undo).toBeDisabled();

    await page.getByTestId('bed-canvas').focus();
    await page.keyboard.press('Control+Shift+Z');
    await expect(kale).toHaveAttribute('data-x', '70');
    await expect(redo).toBeDisabled();
    await page.keyboard.press('Control+Z');
    await expect(kale).toHaveAttribute('data-x', '40');

    await page.reload();
    await expect(page.getByTestId(`planting-${KALE_ID}`)).toHaveAttribute('data-x', '40');
  });

  test('moves and deletes with the keyboard, undo brings it back', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard editing is a desktop feature.');
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
    const tomato = page.getByTestId('bed-canvas').getByRole('button', { name: 'Tomate' });
    await tomato.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(tomato).toHaveAttribute('data-x', '115');
    await expect(tomato).toHaveAttribute('data-y', '75');

    await page.keyboard.press('Delete');
    await expect(tomato).toHaveCount(0);
    await expect.poll(() => stored(page, TOMATO_ID)).toBeNull();

    await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeEnabled();
    await page.keyboard.press('Control+Z');
    // Recreated by the server with a new id, at the last position.
    await expect(tomato).toHaveAttribute('data-x', '115');
    // Undo waits for running requests, so step by step.
    await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeEnabled();
    await page.keyboard.press('Control+Z');
    await expect(tomato).toHaveAttribute('data-y', '50');
    await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeEnabled();
    await page.keyboard.press('Control+Z');
    await expect(tomato).toHaveAttribute('data-x', '120');
    await expect(tomato).toHaveAttribute('data-y', '50');
  });

  test('shows details, changes the end and removes from the chosen week', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'The detail panel is a desktop sidebar; phones get a bottom sheet (T-27).');
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
    await page.getByTestId('bed-canvas').getByRole('button', { name: 'Tomate' }).click();

    const panel = page.getByRole('complementary', { name: 'Pflanzung Tomate' });
    await expect(panel).toContainText('Einzelpflanze');
    await expect(panel).toContainText('120 × 50 cm');
    await expect(panel).toContainText('Mo., 3. August 2026 (KW 32)');
    // 22 weeks of culture.
    await expect(panel).toContainText('Mo., 4. Januar 2027 (KW 1)aus der Standzeit');

    const end = panel.getByLabel('Ende anpassen');
    await end.fill('2026-08-01');
    await panel.getByRole('button', { name: 'Übernehmen' }).click();
    await expect(panel.getByRole('alert')).toHaveText('Ende muss nach dem Start liegen.');
    await end.fill('2026-11-30');
    await panel.getByRole('button', { name: 'Übernehmen' }).click();
    await expect(panel).toContainText('Mo., 30. November 2026 (KW 49)angepasst');
    await expect.poll(() => stored(page, TOMATO_ID)).toMatchObject({ endDate: '2026-11-30' });

    // Wednesday 7 October 2026 is in KW 41; removal starts on its Monday.
    await panel.getByRole('button', { name: 'Entfernen ab KW 41' }).click();
    await expect(
      page.getByTestId('bed-canvas').getByRole('button', { name: 'Tomate' }),
    ).toHaveCount(0);
    await expect(panel).toBeHidden();
    await expect
      .poll(() => stored(page, TOMATO_ID))
      .toMatchObject({ removedDate: '2026-10-05', endDate: '2026-11-30' });

    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(
      page.getByTestId('bed-canvas').getByRole('button', { name: 'Tomate' }),
    ).toBeVisible();
    await expect.poll(() => stored(page, TOMATO_ID)).toMatchObject({ removedDate: null });
  });

  test('changes the length of an existing row with its handle', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The handle is dragged with the mouse here.');
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
    const carrots = page.getByTestId(`planting-${CARROT_ID}`);
    await carrots.click();
    const handle = page.getByRole('slider', { name: 'Länge der Reihe Möhre' });
    await expect(handle).toHaveAttribute('aria-valuenow', '60');
    await handle.focus();
    await page.keyboard.press('ArrowDown');
    await expect(carrots).toHaveAttribute('data-length-cm', '65');
    await page.keyboard.press('Control+Z');
    await expect(carrots).toHaveAttribute('data-length-cm', '60');
  });
});

test('selected planting with details matches screenshot', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop layout.');
  await signInAs(page, 'user');
  await seedGarden(page, garden);
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await page.getByTestId('bed-canvas').getByRole('button', { name: 'Tomate' }).click();
  await expect(page.getByRole('complementary', { name: 'Pflanzung Tomate' })).toBeVisible();
  await expect(page).toHaveScreenshot('planting-details.png', { fullPage: true });
});

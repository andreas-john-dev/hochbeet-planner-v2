import type { Locator, Page } from '@playwright/test';
import { expect, open, signInAs, test, USERS } from './fixtures';
import { bed, planting, seedGarden } from './garden';

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const TOMATO = '01M49THV00QS1SEJEM64991JH5'; // Tomate, 22 weeks
const POTATO = '01M49THV00ZXD963BV15Z5DW76'; // Kartoffel, 16 weeks
const LETTUCE = '01M49THV00RK9E9PC83NEE87CJ'; // Kopfsalat, 8 weeks
const TOMATO_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T01';
const POTATO_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T02';
const LETTUCE_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T03';

const canvas = (page: Page) => page.getByTestId('bed-canvas');

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function screenPoint(page: Page, cm: { x: number; y: number }) {
  const box = await page.getByTestId('bed-grid').boundingBox();
  if (!box) throw new Error('bed not drawn');
  const pxPerCm = box.width / 200;
  return { x: box.x + cm.x * pxPerCm, y: box.y + cm.y * pxPerCm };
}

test('potato next to tomato warns while dragging, and saving still works', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Dragging from the palette is a desktop feature.');
  await signInAs(page, 'user');
  // A tomato planted this week (KW 41).
  await seedGarden(page, {
    beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)],
    plantings: [planting(TOMATO_ID, BED_ID, TOMATO, { x: 60, y: 50, startDate: '2026-10-05' })],
  });
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  const tomato = page.getByTestId(`planting-${TOMATO_ID}`);
  await expect(tomato).not.toHaveAttribute('data-status', /.+/);
  await expect(page.getByTestId('findings-summary')).toHaveText('Keine Warnungen');

  const palette = page.getByRole('complementary', { name: 'Pflanzen hinzufügen' });
  await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill('Kartoffel');
  const from = await center(palette.getByRole('button', { name: 'Kartoffel' }));
  const to = await screenPoint(page, { x: 110, y: 50 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 10 });

  // Still dragging: the preview and the tomato are marked, the list says why.
  await expect(page.getByTestId('placement-preview')).toHaveAttribute('data-status', 'warning');
  await expect(tomato).toHaveAttribute('data-status', 'warning');
  await expect(tomato).toHaveAccessibleName('Tomate (Warnung)');
  const list = page.getByRole('list', { name: 'Hinweise' });
  await expect(list).toContainText('Kartoffel und Tomate sind schlechte Nachbarn.');
  await expect(list.locator('[data-severity="warning"]').first()).toBeVisible();
  await expect(page).toHaveScreenshot('warning-while-dragging.png');

  // Dropping saves the potato despite the warning.
  await page.mouse.up();
  const potato = canvas(page).getByRole('button', { name: 'Kartoffel (Warnung)' });
  await expect(potato).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        ([user, plantId]) =>
          (
            JSON.parse(localStorage.getItem('hochbeet-mock-api') ?? '{}') as Record<
              string,
              { plantings: { plantId: string }[] }
            >
          )[user]?.plantings.some((p) => p.plantId === plantId),
        [USERS.user.email, POTATO] as const,
      ),
    )
    .toBe(true);

  // The overview counts the warnings of the season.
  await page.getByRole('link', { name: 'Alle Beete' }).click();
  await expect(page.getByTestId('season-warnings')).toHaveText(/^\d+ Warnungen? in dieser Saison$/);
});

test.describe('findings list', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'user');
    // May: tomato and potato too close, lettuce a good neighbour of the tomato.
    await seedGarden(page, {
      beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)],
      plantings: [
        planting(TOMATO_ID, BED_ID, TOMATO, { x: 50, y: 40, startDate: '2026-05-04' }),
        planting(POTATO_ID, BED_ID, POTATO, { x: 110, y: 40, startDate: '2026-05-04' }),
        planting(LETTUCE_ID, BED_ID, LETTUCE, { x: 50, y: 85, startDate: '2026-05-04' }),
      ],
    });
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  });

  test('jumps to the week of a finding and highlights its plantings', async ({ page }) => {
    // In October all three are gone, but the season still lists their findings.
    const label = page.getByTestId('week-label');
    await expect(label).toContainText('KW 41');
    const list = page.getByRole('list', { name: 'Hinweise' });
    const bad = list.getByRole('button', { name: /Kartoffel und Tomate sind schlechte Nachbarn/ });
    await expect(bad).toContainText('KW 19 – KW 34 2026');

    await bad.click();
    await expect(label).toContainText('KW 19');
    await expect(bad).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId(`planting-${TOMATO_ID}`)).toHaveAttribute(
      'data-highlighted',
      'true',
    );
    await expect(page.getByTestId(`planting-${POTATO_ID}`)).toHaveAttribute(
      'data-highlighted',
      'true',
    );
    await expect(page.getByTestId(`planting-${LETTUCE_ID}`)).not.toHaveAttribute(
      'data-highlighted',
      'true',
    );

    // Status per planting: the worst finding wins; good neighbours are green.
    await expect(page.getByTestId(`planting-${TOMATO_ID}`)).toHaveAttribute(
      'data-status',
      'warning',
    );
    await expect(page.getByTestId(`planting-${LETTUCE_ID}`)).toHaveAttribute(
      'data-status',
      'positive',
    );
    await expect(
      list.getByRole('button', { name: /Kopfsalat und Tomate sind gute Nachbarn/ }),
    ).toBeVisible();

    // A second click removes the highlight.
    await bad.click();
    await expect(page.getByTestId(`planting-${TOMATO_ID}`)).not.toHaveAttribute(
      'data-highlighted',
      'true',
    );
  });
});

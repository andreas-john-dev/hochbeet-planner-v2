import type { Page } from '@playwright/test';
import { expect, open, signInAs, test, USERS } from './fixtures';
import { bed, planting, PLANTS, seedGarden } from './garden';

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const LETTUCE = '01M49THV00RK9E9PC83NEE87CJ'; // Kopfsalat
const TOMATO = '01M49THV00QS1SEJEM64991JH5'; // Tomate, 22 weeks
const LETTUCE_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T01';
const TOMATO_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T02';

// Lettuce in April, tomato from May at the same place; rosemary is perennial.
const garden = {
  beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)],
  plantings: [
    planting(LETTUCE_ID, BED_ID, LETTUCE, {
      x: 50,
      y: 50,
      startDate: '2026-04-06',
      endDate: '2026-05-04',
    }),
    planting(TOMATO_ID, BED_ID, TOMATO, { x: 50, y: 50, startDate: '2026-05-04' }),
    planting('01J9ZQ3W8D6V2K5M7N8P9R0T03', BED_ID, PLANTS.rosemary, {
      x: 150,
      y: 50,
      startDate: '2026-04-06',
    }),
  ],
};

/** A planting in the bed by plant name; the name may carry a status, e.g. "(Warnung)". */
const inBed = (page: Page, name: string) =>
  page.getByTestId('bed-canvas').getByRole('button', { name: new RegExp(`^${name}( \\(|$)`) });

/** Moves the slider to the n-th Monday of the year (0 = first). */
async function slideTo(page: Page, index: number) {
  const slider = page.getByRole('slider', { name: 'Woche wählen' });
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < index; i++) await page.keyboard.press('ArrowRight');
}

test.describe('week slider', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'user');
    await seedGarden(page, garden);
    await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  });

  test('shows the right plant at the same place in April and May', async ({ page }) => {
    const label = page.getByTestId('week-label');
    await expect(label).toHaveText('5. – 11. Oktober 2026 · KW 41');
    await expect(inBed(page, 'Kopfsalat')).toHaveCount(0);
    await expect(inBed(page, 'Tomate')).toHaveCount(0);

    // April: lettuce, with the tomato that follows as a ghost.
    await slideTo(page, 13);
    await expect(label).toHaveText('6. – 12. April 2026 · KW 15');
    await expect(inBed(page, 'Kopfsalat')).toBeVisible();
    await expect(inBed(page, 'Tomate')).toHaveCount(0);
    await expect(page.getByTestId(`ghost-${TOMATO_ID}`)).toHaveAttribute('data-ghost', 'after');

    // May: tomato, with the lettuce before it as a ghost.
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await expect(label).toHaveText('4. – 10. Mai 2026 · KW 19');
    await expect(inBed(page, 'Tomate')).toBeVisible();
    await expect(inBed(page, 'Kopfsalat')).toHaveCount(0);
    await expect(page.getByTestId(`ghost-${LETTUCE_ID}`)).toHaveAttribute('data-ghost', 'before');

    await page.getByRole('button', { name: 'Heute' }).click();
    await expect(label).toHaveText('5. – 11. Oktober 2026 · KW 41');
  });

  test('perennials stay visible in every later week', async ({ page }) => {
    const label = page.getByTestId('week-label');
    const rosemary = inBed(page, 'Rosmarin');
    await slideTo(page, 12);
    await expect(label).toContainText('KW 14');
    await expect(rosemary).toHaveCount(0); // planted a week later

    for (const index of [13, 30, 51]) {
      await slideTo(page, index);
      await expect(rosemary).toBeVisible();
    }
    // Into the next year.
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await expect(label).toHaveText('4. – 10. Januar 2027 · KW 1');
    await expect(rosemary).toBeVisible();
  });

  test('new plantings start in the chosen week', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Placed with the keyboard here; tap-to-place is covered in mobile.spec.');
    await slideTo(page, 17);
    await expect(page.getByTestId('week-label')).toContainText('KW 19');
    const palette = page.getByRole('complementary', { name: 'Pflanzen hinzufügen' });
    await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill('Basilikum');
    await palette.getByRole('button', { name: 'Basilikum' }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(inBed(page, 'Basilikum')).toBeVisible();

    const stored = () =>
      page.evaluate((user) => {
        const data = JSON.parse(localStorage.getItem('hochbeet-mock-api') ?? '{}') as Record<
          string,
          { plantings: { plantId: string; startDate: string }[] }
        >;
        return data[user]?.plantings.find((p) => p.plantId === '01M49THV0081S9TVW6N7P7AW3Q');
      }, USERS.user.email);
    await expect.poll(stored).toMatchObject({ startDate: '2026-05-04' });

    // Back in October the basil (16 weeks) is long gone.
    await page.getByRole('button', { name: 'Heute' }).click();
    await expect(inBed(page, 'Basilikum')).toHaveCount(0);
  });
});

test('editor with week slider and ghost matches screenshot', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, garden);
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await slideTo(page, 17);
  await expect(page.getByTestId(`ghost-${LETTUCE_ID}`)).toBeVisible();
  // The slider had the focus and scrolled the page; start the full-page capture at the top.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await expect(page).toHaveScreenshot('week-slider.png', { fullPage: true });
});

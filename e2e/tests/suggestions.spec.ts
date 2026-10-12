import type { Page } from '@playwright/test';
import { requestSuggestions } from './assistant-helpers';
import { expect, open, signInAs, test, USERS } from './fixtures';
import { EXAMPLE_BED_ID, exampleGarden, seedGarden } from './garden';

// Planting suggestions of the assistant (T-43) against the mock: two fixed suggestions
// (Kopfsalat, a row of Radieschen) shown as dashed plantings, taken over or discarded.

const LETTUCE = '01M49THV00RK9E9PC83NEE87CJ';
const RADISH = '01M49THV00NAC3VGAMQF7XGNWF';

const planted = (page: Page, plantId: string) =>
  page.locator(`[data-testid^="planting-"][data-plant-id="${plantId}"]`);

/** On phones the chat is a bottom sheet over the bed; close it to reach the toolbar. */
async function backToBed(page: Page, isMobile: boolean) {
  if (!isMobile) return;
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Beet-Assistent' })).toBeHidden();
}

test.describe('assistant suggestions', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'admin');
    await seedGarden(page, exampleGarden, USERS.admin.email);
    await open(page, `/beete/${EXAMPLE_BED_ID}`, 'Hochbeet Süd');
  });

  test('shows suggestions in the bed, takes one over and undoes it', async ({ page, isMobile }) => {
    await requestSuggestions(page);
    const lettuce = page.getByTestId('suggestion-0');
    await expect(lettuce).toHaveAttribute('data-plant-id', LETTUCE);
    await expect(lettuce).toHaveAttribute('data-x', '130');
    // The rule engine rates suggestions like plantings.
    await expect(lettuce).toHaveAttribute('data-status', /warning|hint|positive/);
    await expect(page.getByTestId('suggestion-1')).toHaveAttribute('data-kind', 'ROW');
    await expect(page.getByText('Kopfsalat wächst schnell')).toBeVisible();
    await expect(planted(page, LETTUCE)).toHaveCount(0);

    await page.getByRole('button', { name: 'Kopfsalat übernehmen' }).click();
    await expect(planted(page, LETTUCE)).toHaveAttribute('data-x', '130');
    await expect(lettuce).toHaveCount(0);
    await expect(page.getByTestId('suggestion-1')).toHaveCount(1);

    await backToBed(page, isMobile);
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(planted(page, LETTUCE)).toHaveCount(0);
    // Saved like a planting placed by hand: after a reload it is still gone.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Hochbeet Süd' })).toBeVisible();
    await expect(planted(page, LETTUCE)).toHaveCount(0);
  });

  test('takes all suggestions over at once', async ({ page }) => {
    await requestSuggestions(page);
    await page.getByRole('button', { name: 'Alle übernehmen' }).click();
    await expect(planted(page, LETTUCE)).toHaveCount(1);
    await expect(planted(page, RADISH)).toHaveAttribute('data-length-cm', '30');
    await expect(page.getByRole('region', { name: 'Pflanzvorschläge im Beet' })).toBeHidden();
    await expect(page.getByTestId('suggestions').locator('*')).toHaveCount(0);
  });

  test('discards the suggestions without planting anything', async ({ page }) => {
    await requestSuggestions(page);
    await page.getByRole('button', { name: 'Verwerfen' }).click();
    await expect(page.getByTestId('suggestion-0')).toHaveCount(0);
    await expect(page.getByTestId('suggestion-1')).toHaveCount(0);
    await expect(planted(page, LETTUCE)).toHaveCount(0);
    await expect(planted(page, RADISH)).toHaveCount(0);
  });
});

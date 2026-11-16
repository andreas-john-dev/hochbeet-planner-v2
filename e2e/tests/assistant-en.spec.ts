import type { Page } from '@playwright/test';
import { expect, open, signInAs, test, USERS } from './fixtures';
import { EXAMPLE_BED_ID, exampleGarden, seedGarden } from './garden';

// The Beet-Assistent in an English app (T-72) against the mock: the app sends its language,
// the mock answers, suggests and refuses in English, and suggestions can be taken over.
test.use({ language: 'en' });

const LETTUCE = '01M49THV00RK9E9PC83NEE87CJ';
const RADISH = '01M49THV00NAC3VGAMQF7XGNWF';

const ANSWER =
  'Happy to help! I have looked at your bed. Tomatoes get on well with Basil, but keep 50 cm between the plants.';

const planted = (page: Page, plantId: string) =>
  page.locator(`[data-testid^="planting-"][data-plant-id="${plantId}"]`);

async function openAssistant(page: Page) {
  await page.getByRole('button', { name: 'Assistant', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Question for the assistant' });
  await expect(input).toBeVisible();
  return input;
}

test.describe('assistant in English', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'admin');
    await seedGarden(page, exampleGarden, USERS.admin.email);
    await open(page, `/beete/${EXAMPLE_BED_ID}`, 'Hochbeet Süd');
  });

  test('answers an English question in English', async ({ page }) => {
    const input = await openAssistant(page);
    await input.fill('What goes well with tomatoes?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    // The mock answers in the language the app sends with the question.
    const log = page.getByRole('log');
    await expect(log.getByText(ANSWER)).toBeVisible();
    await expect(log.locator('strong', { hasText: 'Basil' })).toBeVisible();
    await expect(page.getByText('19 questions left today.')).toBeVisible();
  });

  test('shows the guardrail message in English', async ({ page }) => {
    const input = await openAssistant(page);
    await input.fill('Who will win the Fußball World Cup?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(
      page
        .getByRole('log')
        .getByText(
          "Sorry, I can't help you with that. Feel free to ask me about your beds, plants or raising seedlings.",
        ),
    ).toBeVisible();
  });

  test('suggests plantings with English reasons and takes them over', async ({ page }) => {
    await openAssistant(page);
    await page.getByRole('button', { name: 'Planting suggestions' }).click();
    await expect(
      page.getByRole('region', { name: 'Planting suggestions in the bed' }),
    ).toBeVisible();
    await expect(page.getByText('Two suggestions for the free space in the middle.')).toBeVisible();
    await expect(page.getByText('Lettuce grows quickly and fills the gap')).toBeVisible();
    await expect(page.getByTestId('suggestion-0')).toHaveAttribute('data-plant-id', LETTUCE);

    await expect(page.getByRole('button', { name: 'Accept Lettuce' })).toBeVisible();

    await page.getByRole('button', { name: 'Accept all' }).click();
    await expect(planted(page, LETTUCE)).toHaveAttribute('data-x', '130');
    await expect(planted(page, RADISH)).toHaveAttribute('data-length-cm', '30');
    await expect(
      page.getByRole('region', { name: 'Planting suggestions in the bed' }),
    ).toBeHidden();
  });
});

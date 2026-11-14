import { expect, open, signInAs, test, USERS } from './fixtures';
import {
  askAssistant,
  BLOCKED_ANSWER,
  exhaustAssistantQuota,
  MOCK_ANSWER,
  openAssistant,
} from './assistant-helpers';
import { EXAMPLE_BED_ID, exampleGarden, seedGarden } from './garden';

// The Beet-Assistent in the editor (T-42) against the mock assistant of the dev server:
// admins (and ai-testers) see it, the answer streams in, the quota error shows.

const EDITOR = `/beete/${EXAMPLE_BED_ID}`;

test.describe('assistant chat', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'admin');
    await seedGarden(page, exampleGarden, USERS.admin.email);
  });

  test('asks a question and shows the streamed answer with the quota left', async ({ page }) => {
    await open(page, EDITOR, 'Hochbeet Süd');
    const input = await openAssistant(page);
    await expect(
      page.getByText('Antworten stammen von einer KI und können falsch sein.', { exact: false }),
    ).toBeVisible();
    await input.fill('Was passt zu Tomaten?');
    await page.getByRole('button', { name: 'Fragen' }).click();

    const log = page.getByRole('log');
    await expect(log.getByText('Was passt zu Tomaten?')).toBeVisible();
    // The first chunk is there before the answer is complete.
    await expect(log.getByText(/Gern!/)).toBeVisible();
    await expect(log.getByText(MOCK_ANSWER)).toBeVisible();
    // The answer's Markdown is rendered, also across chunks: bold, without the stars.
    await expect(log.locator('[data-role="assistant"] strong')).toHaveText('Basilikum');
    await expect(log).not.toContainText('**');
    await expect(page.getByText('Noch 19 Fragen heute.')).toBeVisible();
    await expect(input).toHaveValue('');
  });

  test('shows the guardrail message for a blocked question like an answer', async ({ page }) => {
    await open(page, EDITOR, 'Hochbeet Süd');
    const input = await openAssistant(page);
    // The mock blocks questions with this word, as the guardrail blocks off-topic ones.
    await input.fill('Wer wird Fußball-Weltmeister?');
    await page.getByRole('button', { name: 'Fragen' }).click();
    const log = page.getByRole('log');
    await expect(log.locator('[data-role="assistant"]').getByText(BLOCKED_ANSWER)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('Noch 19 Fragen heute.')).toBeVisible();
  });

  test('can cancel an answer while it streams', async ({ page }) => {
    await open(page, EDITOR, 'Hochbeet Süd');
    const input = await openAssistant(page);
    await input.fill('Erzähl mir alles über Kohl.');
    await input.press('Enter');
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('log').getByText(/\(abgebrochen\)$/)).toBeVisible();
    await expect(page.getByRole('log').getByText(MOCK_ANSWER)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Fragen' })).toBeVisible();
  });

  test('shows the quota error in German', async ({ page }) => {
    await exhaustAssistantQuota(page, USERS.admin.email);
    await open(page, EDITOR, 'Hochbeet Süd');
    const input = await openAssistant(page);
    await input.fill('Noch eine Frage?');
    await page.getByRole('button', { name: 'Fragen' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Du hast heute schon 20 Fragen gestellt. Morgen geht es weiter.',
    );
  });

  test('works with the keyboard alone', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard use is a desktop concern.');
    await open(page, EDITOR, 'Hochbeet Süd');
    const toggle = page.getByRole('button', { name: 'Assistent', exact: true });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Opening the panel puts the focus into the question field.
    const input = page.getByRole('textbox', { name: 'Frage an den Assistenten' });
    await expect(input).toBeFocused();
    await page.keyboard.type('Was passt zu Tomaten?');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('log').getByText(MOCK_ANSWER)).toBeVisible();
    // Closing keeps the conversation for later.
    await page.getByRole('button', { name: 'Assistent schließen' }).click();
    await expect(input).toBeHidden();
    await toggle.click();
    await expect(page.getByRole('log').getByText(MOCK_ANSWER)).toBeVisible();
  });

  test('opens as bottom sheet on phones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Phones only.');
    await open(page, EDITOR, 'Hochbeet Süd');
    await askAssistant(page);
    await expect(page.getByRole('dialog', { name: 'Beet-Assistent' })).toBeVisible();
  });
});

test('users without assistant group see no chat', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, exampleGarden);
  await open(page, EDITOR, 'Hochbeet Süd');
  await expect(page.getByRole('button', { name: 'Assistent', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Frage an den Assistenten' })).toHaveCount(0);
});

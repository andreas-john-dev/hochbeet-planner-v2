import { expect, type Page } from '@playwright/test';

/** Fixed answer of the mock assistant (apps/web/src/mocks/assistant.ts), with a bed. */
export const MOCK_ANSWER =
  'Gern! Ich habe mir dein Beet angesehen. Tomaten vertragen sich gut mit Basilikum, halte aber 50 cm Abstand zwischen den Pflanzen.';

/** Questions to the mock assistant per user and day (MockStore, ASSISTANT_QUOTA_KEY). */
const QUOTA_KEY = 'hochbeet-mock-assistant';

/** Uses up the mock assistant's daily quota of `email` on the fixed test day. */
export async function exhaustAssistantQuota(page: Page, email: string) {
  await page.addInitScript(
    ([key, user]) => {
      localStorage.setItem(key, JSON.stringify({ [user]: { day: '2026-10-07', count: 20 } }));
    },
    [QUOTA_KEY, email] as const,
  );
}

/** Opens the assistant in the editor (side panel or bottom sheet) and returns its input. */
export async function openAssistant(page: Page) {
  await page.getByRole('button', { name: 'Assistent', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Frage an den Assistenten' });
  await expect(input).toBeVisible();
  return input;
}

/** Asks one question and waits for the complete streamed answer. */
export async function askAssistant(page: Page, question = 'Was passt zu Tomaten?') {
  const input = await openAssistant(page);
  await input.fill(question);
  await page.getByRole('button', { name: 'Fragen' }).click();
  await expect(page.getByRole('log').getByText(MOCK_ANSWER)).toBeVisible();
  await expect(page.getByText('Noch 19 Fragen heute.')).toBeVisible();
}

/** Asks for planting suggestions and waits until the mock's two suggestions are in the bed. */
export async function requestSuggestions(page: Page) {
  await openAssistant(page);
  await page.getByRole('button', { name: 'Pflanzvorschläge' }).click();
  await expect(page.getByRole('region', { name: 'Pflanzvorschläge im Beet' })).toBeVisible();
  await expect(page.getByTestId('suggestion-0')).toHaveCount(1);
  await expect(page.getByTestId('suggestion-1')).toHaveCount(1);
  // The list scrolls into view, possibly under the pointer: no hover state in checks and shots.
  await page.mouse.move(0, 0);
}

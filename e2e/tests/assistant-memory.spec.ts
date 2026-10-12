import { expect, open, signInAs, test, USERS } from './fixtures';
import {
  askAssistant,
  EXAMPLE_PREFERENCES,
  MOCK_ANSWER,
  seedAssistantMemories,
} from './assistant-helpers';
import { EXAMPLE_BED_ID, exampleGarden, seedGarden } from './garden';

// The assistant's memory (T-44) against the mock: it remembers statements about the user,
// the profile lists them and deletes everything, and a new conversation starts afresh.

const EDITOR = `/beete/${EXAMPLE_BED_ID}`;

test.describe('assistant memory', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'admin');
  });

  test('lists the remembered preferences in the profile and deletes them all', async ({ page }) => {
    await seedAssistantMemories(page, USERS.admin.email, EXAMPLE_PREFERENCES);
    await open(page, '/profil', 'Profil');
    const list = page.getByRole('list', { name: 'Gemerkte Vorlieben' });
    await expect(list.getByRole('listitem')).toHaveText(EXAMPLE_PREFERENCES);

    await page.getByRole('button', { name: 'Alles löschen' }).click();
    const dialog = page.getByRole('alertdialog', {
      name: 'Alles löschen, was der Assistent weiß?',
    });
    await expect(dialog).toContainText('gespeicherten Gespräche');
    await dialog.getByRole('button', { name: 'Alles löschen' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Der Assistent hat alles vergessen.')).toBeVisible();
    await expect(list).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('Noch keine Vorlieben gemerkt.')).toBeVisible();
  });

  test('keeps the preferences when deleting is cancelled', async ({ page }) => {
    await seedAssistantMemories(page, USERS.admin.email, EXAMPLE_PREFERENCES);
    await open(page, '/profil', 'Profil');
    await page.getByRole('button', { name: 'Alles löschen' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Abbrechen' }).click();
    await expect(
      page.getByRole('list', { name: 'Gemerkte Vorlieben' }).getByRole('listitem'),
    ).toHaveCount(EXAMPLE_PREFERENCES.length);
  });

  test('remembers what the user tells the assistant', async ({ page }) => {
    await seedGarden(page, exampleGarden, USERS.admin.email);
    await open(page, EDITOR, 'Hochbeet Süd');
    await askAssistant(page, 'Ich mag keinen Fenchel.');
    await open(page, '/profil', 'Profil');
    await expect(
      page.getByRole('list', { name: 'Gemerkte Vorlieben' }).getByRole('listitem'),
    ).toHaveText(['Ich mag keinen Fenchel.']);
  });

  test('starts a new conversation', async ({ page }) => {
    await seedGarden(page, exampleGarden, USERS.admin.email);
    await open(page, EDITOR, 'Hochbeet Süd');
    await askAssistant(page);
    await page.getByRole('button', { name: 'Neue Unterhaltung' }).click();
    const log = page.getByRole('log');
    await expect(log.getByText(MOCK_ANSWER)).toHaveCount(0);
    await expect(log.getByText(/Frag zum Beispiel/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Neue Unterhaltung' })).toHaveCount(0);
    // The chat keeps working in the new conversation.
    const input = page.getByRole('textbox', { name: 'Frage an den Assistenten' });
    await expect(input).toBeFocused();
    await input.fill('Und Basilikum?');
    await input.press('Enter');
    await expect(log.getByText(MOCK_ANSWER)).toBeVisible();
  });
});

test('users without the assistant see no memory in the profile', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/profil', 'Profil');
  await expect(page.getByRole('heading', { name: 'Darstellung' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Beet-Assistent' })).toHaveCount(0);
});

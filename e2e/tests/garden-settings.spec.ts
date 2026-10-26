import { expect, open, signInAs, test } from './fixtures';
import { seedGarden } from './garden';

const TOMATO = '01M49THV00QS1SEJEM64991JH5'; // raised KW 11–16 for 7–13 weeks, frost sensitive

test('changes the last frost in the profile, keeps it and resets it', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, { beds: [], plantings: [] });
  await open(page, '/profil', 'Profil');
  const card = page.getByRole('group', { name: 'Letzter Frost' });
  await expect(card.getByLabel('Tag')).toHaveValue('15');
  await expect(card.getByLabel('Monat')).toHaveValue('5');
  const reset = page.getByRole('button', { name: 'Auf 15. Mai zurücksetzen' });
  await expect(reset).toBeDisabled();

  await card.getByLabel('Tag').selectOption('20');
  await card.getByLabel('Monat').selectOption({ label: 'April' });
  await card.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('status')).toHaveText('Gespeichert: letzter Frost am 20. April.');

  await page.reload();
  await expect(card.getByLabel('Tag')).toHaveValue('20');
  await expect(card.getByLabel('Monat')).toHaveValue('4');

  // The sowing calendar plants tomatoes out after the new date: Monday 27 April 2026 is KW 18.
  await open(page, `/katalog/${TOMATO}`, 'Tomate');
  const calendar = page.getByRole('region', { name: 'Aussaatkalender' });
  await expect(calendar.locator('[data-row="plantOut"]')).toContainText('KW 18–29');
  await expect(calendar).toContainText('Frostempfindlich, erst nach dem 20. April ins Freie');

  await open(page, '/profil', 'Profil');
  await reset.click();
  await expect(card.getByLabel('Tag')).toHaveValue('15');
  await expect(card.getByLabel('Monat')).toHaveValue('5');
  await expect(reset).toBeDisabled();
  await page.reload();
  await expect(card.getByLabel('Monat')).toHaveValue('5');
});

test('keeps the day inside the chosen month', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/profil', 'Profil');
  const card = page.getByRole('group', { name: 'Letzter Frost' });
  await card.getByLabel('Monat').selectOption({ label: 'März' });
  await card.getByLabel('Tag').selectOption('31');
  await card.getByLabel('Monat').selectOption({ label: 'April' });
  await expect(card.getByLabel('Tag')).toHaveValue('30');
});

import { expect, open, signInAs, test } from './fixtures';

// Messages of the contract schemas in English (packages/contracts/src/messages).
test.use({ language: 'en' });

test('shows English validation messages for a bed without a name', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/beete', 'My beds');
  await page.getByRole('button', { name: 'Create your first bed' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create bed' });
  await dialog.getByLabel('Width (cm)').fill('203');
  await dialog.getByRole('button', { name: 'Create bed' }).click();
  await expect(dialog.getByText('Please enter a name.')).toBeVisible();
  await expect(dialog.getByText('Must be a multiple of 5 cm.')).toBeVisible();
  await expect(dialog.getByText('Bitte einen Namen angeben.')).toHaveCount(0);
});

test('shows English validation messages for a batch', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/anzucht', 'Seedlings');
  await page.getByRole('button', { name: 'Create your first batch' }).click();
  const dialog = page.getByRole('dialog', { name: 'New batch' });
  await dialog.getByRole('searchbox', { name: 'Search plants' }).fill('Tomate');
  await dialog.getByRole('radio', { name: /Tomate/ }).check();
  await dialog.getByLabel('Amount sown').fill('0');
  await dialog.getByRole('button', { name: 'Create batch' }).click();
  await expect(dialog.getByText('Enter a number from 1 to 9999.')).toBeVisible();
});

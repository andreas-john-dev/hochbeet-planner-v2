import { expect, open, signInAs, test } from './fixtures';

// English names of the start catalogue (T-71): shown in English, found by both names.
test.use({ language: 'en' });

test('shows English plant names and finds them by English and German name', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/katalog', 'Plant catalogue');
  const list = page.getByRole('list', { name: 'Plants' });
  await expect(list.getByRole('link', { name: /^Lettuce/ })).toContainText('Daisy family');

  const search = page.getByRole('searchbox', { name: 'Search plant or family' });
  for (const query of ['lettuce', 'Kopfsalat']) {
    await search.fill(query);
    await expect(list.getByRole('link', { name: /^Lettuce/ })).toBeVisible();
  }
  await search.fill('lettuce');
  // Lamb's lettuce, Lettuce and Loose-leaf lettuce, sorted by their English names.
  await expect(list.getByRole('link')).toHaveText([/^Lamb's lettuce/, /^Lettuce/, /^Loose-leaf/]);

  await list.getByRole('link', { name: /^Lettuce/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lettuce' })).toBeVisible();
  await expect(page.getByText('Vegetables · Daisy family')).toBeVisible();
});

test('lets admins give a global plant English names', async ({ page }) => {
  await signInAs(page, 'admin');
  await open(page, '/admin', 'Administration');
  await page.getByRole('link', { name: /^Lettuce/ }).click();
  const english = page.getByRole('group', { name: 'In English' });
  await expect(english.getByLabel('English name')).toHaveValue('Lettuce');
  await english.getByLabel('English name').fill('Butterhead lettuce');
  await english.getByLabel('English family').fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(english.getByText('Please enter the English family as well.')).toBeVisible();
  await english.getByLabel('English family').fill('Daisy family');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: /^Butterhead lettuce/ })).toBeVisible();
});

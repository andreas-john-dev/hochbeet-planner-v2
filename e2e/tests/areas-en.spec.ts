import { expect, open, signInAs, test } from './fixtures';

// Seedlings, catalogue, own plants and the admin area in English. Plant names, families and
// the week labels from garden-rules stay German until their tasks (T-69, T-71).
test.use({ language: 'en' });

test('creates a batch and moves it on to the next stage', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/anzucht', 'Seedlings');
  await expect(page.getByRole('heading', { name: 'No batches yet' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'catalogue' })).toHaveAttribute(
    'href',
    '/katalog',
  );

  await page.getByRole('button', { name: 'Create your first batch' }).click();
  const dialog = page.getByRole('dialog', { name: 'New batch' });
  await dialog.getByRole('searchbox', { name: 'Search plants' }).fill('Tomate');
  await dialog.getByRole('radio', { name: /Tomate/ }).check();
  await dialog.getByLabel('Amount sown').fill('24');
  // Frost sensitive: planting out waits for the last frost, 15 May by default.
  await expect(dialog.getByText(/frost-sensitive: not before 15 May\.$/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Create batch' }).click();
  await expect(dialog).toBeHidden();

  // Sown this week (the clock stands on 7 October 2026).
  const tomato = page.getByRole('article', { name: 'Tomate' });
  await expect(tomato.getByTestId('stock')).toHaveText('24 sown');
  await tomato.getByRole('button', { name: 'Next: Germinated' }).click();
  await expect(tomato.getByTestId('stock')).toHaveText('alive 24 · allocated 0 · free 24');
  await expect(tomato).toContainText('(24 of 24 germinated)');
  await expect(tomato.getByRole('button', { name: 'Next: Pricked out' })).toBeVisible();
  await expect(tomato.getByRole('button', { name: 'Decrease stock' })).toBeVisible();
});

test('filters the catalogue and opens a plant with its sowing calendar', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/katalog', 'Plant catalogue');
  const list = page.getByRole('list', { name: 'Plants' });
  await expect(page.getByText('56 plants')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search plant or family' }).fill('salat');
  await page.getByRole('button', { name: 'Heavy feeder' }).click();
  await expect(list.getByRole('link')).toHaveText([/^Salatgurke.*Heavy feeder$/]);
  await expect(page.getByText('1 plant', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Heavy feeder' }).click();

  await list.getByRole('link', { name: /^Kopfsalat/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kopfsalat' })).toBeVisible();
  await expect(page.getByText('Vegetables · Korbblütler')).toBeVisible();
  await expect(page.getByText('8 weeks', { exact: true })).toBeVisible();

  const calendar = page.getByRole('region', { name: 'Sowing calendar' });
  await expect(calendar.getByRole('list', { name: 'Sowing calendar 2026' })).toContainText(
    'Start indoors',
  );
  await expect(calendar.locator('[data-row]')).toHaveCount(4);
  await expect(calendar.locator('[data-row="inBed"]')).toContainText('In the bed / harvest');
  await expect(calendar.getByText('3–4 weeks until planting out')).toBeVisible();
});

test('creates an own plant after a form error', async ({ page }) => {
  await signInAs(page, 'user');
  await open(page, '/katalog', 'Plant catalogue');
  await page.getByRole('link', { name: 'Create your own plant' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Create your own plant' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Create plant' }).click();
  await expect(page.getByText('Please enter a name.')).toBeVisible();
  await expect(page.getByText('Please enter 1 to 104 weeks.')).toBeVisible();

  await page.getByLabel('Name').fill('Salsify');
  await expect(page.getByText('Please enter a name.')).toHaveCount(0);
  await page.getByLabel('Family').fill('Korbblütler');
  await page.getByLabel('Feeding').selectOption('SCHWACH');
  await page.getByLabel('Spacing in the row (cm)').fill('10');
  await page.getByLabel('Row spacing (cm)').fill('25');
  await page.getByLabel('Growing time (weeks)').fill('20');
  await page.getByRole('button', { name: 'Create plant' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Salsify' })).toBeVisible();
  await expect(page.getByText('Own plant', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Status: Private' })).toBeVisible();
  await expect(page.getByText('20 weeks', { exact: true })).toBeVisible();
});

test('shows the admin area in English', async ({ page }) => {
  await signInAs(page, 'admin');
  await open(page, '/admin', 'Administration');
  await expect(page.getByRole('heading', { name: 'Queue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No open requests' })).toBeVisible();
  const globals = page.getByRole('list', { name: 'Global plants' });
  await expect(globals.getByRole('listitem')).toHaveCount(56);
  await expect(globals.getByRole('link', { name: /^Kopfsalat/ })).toContainText('Medium feeder');
  await expect(page.getByRole('link', { name: 'Create global plant' })).toBeVisible();
});

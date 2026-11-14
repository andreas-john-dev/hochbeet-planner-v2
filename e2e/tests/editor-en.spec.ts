import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';

// The bed overview and the editor in English, on the desktop and on phones. Plant names stay
// German until the catalogue gets English names (T-71).
test.use({ language: 'en' });

const CARROT = '01M49THV0022SSWEDY081PHP6T';

/** Screen point of a bed position in cm, from the drawn bed outline (200 cm wide). */
async function screenPoint(page: Page, cm: { x: number; y: number }) {
  const box = await page.getByTestId('bed-grid').boundingBox();
  if (!box) throw new Error('bed not drawn');
  const pxPerCm = box.width / 200;
  return { x: box.x + cm.x * pxPerCm, y: box.y + cm.y * pxPerCm };
}

test('creates a bed, plants a row, changes its length and undoes it', async ({
  page,
  isMobile,
}) => {
  await signInAs(page, 'user');
  await open(page, '/beete', 'My beds');
  await expect(page.getByRole('heading', { name: 'No beds yet' })).toBeVisible();

  // Create a bed
  await page.getByRole('button', { name: 'Create your first bed' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create bed' });
  await dialog.getByLabel('Name').fill('South bed');
  await dialog.getByLabel('Width (cm)').fill('200');
  await dialog.getByLabel('Depth (cm)').fill('100');
  await expect(dialog.getByRole('radio', { name: /Parallel to the depth/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Create bed' }).click();
  await expect(dialog).toBeHidden();
  const card = page.getByRole('article', { name: 'South bed' });
  await expect(card).toContainText('200 × 100 cm · Rows parallel to the depth');
  await expect(card).toContainText('No plantings yet');

  // Open the editor
  await card.getByRole('link', { name: 'South bed' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'South bed' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'All beds' })).toBeVisible();
  await expect(page.getByTestId('findings-summary')).toHaveText('No warnings');

  // Plant a carrot row
  if (isMobile) {
    const canvas = page.getByTestId('bed-canvas');
    await canvas.evaluate((el) => {
      el.scrollIntoView({ block: 'center' });
    });
    await page.getByRole('button', { name: 'Add plant' }).tap();
    const sheet = page.getByRole('dialog', { name: 'Add plant' });
    await sheet
      .getByRole('group', { name: 'Planting type' })
      .getByRole('button', { name: 'Row' })
      .tap();
    await sheet.getByRole('searchbox', { name: 'Search varieties' }).fill('Möhre');
    await sheet.getByRole('button', { name: 'Möhre' }).tap();
    await expect(sheet).toBeHidden();
    await expect(page.getByText(/Möhre as row at .* cm: tap the spot in the bed/)).toBeVisible();
    const at = await screenPoint(page, { x: 100, y: 20 });
    await page.touchscreen.tap(at.x, at.y);
    await page
      .getByRole('group', { name: 'Place plant' })
      .getByRole('button', { name: 'Plant here' })
      .tap();
  } else {
    const palette = page.getByRole('complementary', { name: 'Add plants' });
    await palette
      .getByRole('group', { name: 'Planting type' })
      .getByRole('button', { name: 'Row' })
      .click();
    await palette.getByRole('searchbox', { name: 'Search varieties' }).fill('Möhre');
    await palette.getByRole('button', { name: 'Möhre' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Möhre as row at 100 × 50 cm: arrow keys move it/)).toBeVisible();
    await page.keyboard.press('Enter');
  }
  const carrot = page.locator(`[data-plant-id="${CARROT}"]`);
  await expect(carrot).toHaveAttribute('data-kind', 'ROW');
  await expect(carrot).toHaveAttribute(
    'aria-label',
    /^Möhre, row with \d+ plants( \((hint|warning|good neighbours)\))?$/,
  );

  // Change the length with the handle of the selected row, then undo it
  const handle = page.getByRole('slider', { name: 'Length of the row Möhre' });
  const length = Number(await handle.getAttribute('aria-valuenow'));
  await handle.focus();
  await page.keyboard.press('ArrowDown');
  await expect(carrot).toHaveAttribute('data-length-cm', String(length + 5));
  await expect(handle).toHaveAttribute('aria-valuetext', `${String(length + 5)} cm`);

  await page.getByRole('toolbar', { name: 'Edit' }).getByRole('button', { name: 'Undo' }).click();
  await expect(carrot).toHaveAttribute('data-length-cm', String(length));
  await expect(
    page.getByRole('toolbar', { name: 'Edit' }).getByRole('button', { name: 'Redo' }),
  ).toBeEnabled();
});

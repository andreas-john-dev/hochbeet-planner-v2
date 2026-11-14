import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { PLAN_BED_ID, PLANTS, planId, planting, seedGarden, sowingPlanGarden } from './garden';

const planDialog = (page: Page) => page.getByRole('dialog', { name: 'Anzuchtplan' });
const planRow = (page: Page, name: string) =>
  planDialog(page).getByRole('row').filter({ hasText: name });

/** Moves the editor from 7 October 2026 to Monday 17 May 2027 (KW 20). */
async function showMay2027(page: Page) {
  const next = page.getByRole('button', { name: 'Nächste Woche' });
  // KW 41 to KW 53 of 2026, then KW 1 of 2027.
  for (let i = 0; i < 13; i++) await next.click();
  await expect(page.getByTestId('week-label')).toContainText('KW 1');
  const slider = page.getByRole('slider', { name: 'Woche wählen' });
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 19; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('week-label')).toHaveText('17. – 23. Mai 2027 · KW 20');
}

test('plans the raising from the beds and creates the batches', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, sowingPlanGarden);
  await open(page, '/beete', 'Meine Beete');

  await page.getByRole('button', { name: 'Anzuchtplan' }).click();
  const dialog = planDialog(page);
  await expect(dialog).toBeVisible();

  // Tomatoes go out in KW 20 and are raised from KW 11, the start of their window.
  const tomato = planRow(page, 'Tomate');
  await expect(tomato).toContainText('Aussaat KW 11 · 15. – 21. März 2027');
  await expect(tomato).toContainText('Auspflanzen ab KW 20 in „Beet Mai“');
  await expect(tomato.getByRole('cell').nth(2)).toHaveText('4');
  await expect(dialog.getByLabel('Mit Reserve: Tomate, KW 11')).toHaveValue('6');
  // 12 lettuces plus 30 %: 15.6, rounded up.
  const lettuce = planRow(page, 'Kopfsalat');
  await expect(lettuce).toContainText('Aussaat KW 16 · 19. – 25. April 2027');
  await expect(lettuce.getByRole('cell').nth(2)).toHaveText('12');
  await expect(dialog.getByLabel('Mit Reserve: Kopfsalat, KW 16')).toHaveValue('16');

  // A row can be left out and its amount changed.
  const lettuceChosen = dialog.getByRole('checkbox', { name: 'Kopfsalat, KW 16 anlegen' });
  await lettuceChosen.uncheck();
  await expect(dialog.getByRole('button', { name: '1 Charge anlegen' })).toBeVisible();
  await lettuceChosen.check();
  await dialog.getByLabel('Mit Reserve: Kopfsalat, KW 16').fill('18');
  await dialog.getByRole('button', { name: '2 Chargen anlegen' }).click();
  await expect(dialog).toBeHidden();

  // The batches are planned on the raising page, with the plantings linked.
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .filter({ visible: true })
    .getByRole('link', { name: 'Anzucht' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Anzucht' })).toBeVisible();
  const tomatoCard = page.getByRole('article', { name: 'Tomate' });
  await expect(tomatoCard).toContainText('KW 11 · 15. – 21. März 2027');
  await expect(tomatoCard).toContainText('Geplant');
  await expect(tomatoCard).toContainText('Auspflanzen geplant: KW 20 · 17. – 23. Mai 2027');
  await expect(tomatoCard.getByTestId('stock')).toHaveText('6 geplant · verplant 4');
  const lettuceCard = page.getByRole('article', { name: 'Kopfsalat' });
  await expect(lettuceCard.getByTestId('stock')).toHaveText('18 geplant · verplant 12');
  // Planned seeds cover what is planned: no warning about too many.
  await expect(page.getByText(/Mehr in Beeten verplant/)).toHaveCount(0);

  // Opened again, the plan has nothing left to raise.
  await page.getByRole('button', { name: 'Anzuchtplan' }).click();
  await expect(dialog).toContainText('Nichts vorzuziehen');
  await expect(dialog.getByRole('row')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Schließen' }).first().click();
  await expect(dialog).toBeHidden();

  // In the editor each planting names the batch it comes from.
  await open(page, `/beete/${PLAN_BED_ID}`, 'Beet Mai');
  await showMay2027(page);
  await page.getByTestId(`planting-${planId(1)}`).click();
  await expect(page.getByTestId('sowing-origin').filter({ visible: true })).toHaveText(
    'Aus der Anzucht vom 15. – 21. März 2027, 1 von 6. Zur Anzucht',
  );
});

test('marks rows too late to raise and leaves them out', async ({ page }) => {
  await signInAs(page, 'user');
  // Lettuce going out in two weeks: 3–4 weeks of raising started in the past.
  await seedGarden(page, {
    ...sowingPlanGarden,
    plantings: [
      ...sowingPlanGarden.plantings.slice(0, 4),
      planting(planId(9), PLAN_BED_ID, PLANTS.lettuce, { x: 15, y: 70, startDate: '2026-10-19' }),
    ],
  });
  await open(page, '/anzucht', 'Anzucht');
  await page.getByRole('button', { name: 'Anzuchtplan' }).click();

  const late = planRow(page, 'Kopfsalat');
  await expect(late).toContainText('Aussaat KW 41');
  await expect(late).toContainText('Zu spät zum Vorziehen – Jungpflanzen kaufen?');
  await expect(
    planDialog(page).getByRole('checkbox', { name: 'Kopfsalat, KW 41 anlegen' }),
  ).not.toBeChecked();
  await expect(planDialog(page).getByRole('button', { name: '1 Charge anlegen' })).toBeVisible();
});

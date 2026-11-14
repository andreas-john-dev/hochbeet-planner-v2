import type { Page } from '@playwright/test';
import { expect, open, signInAs, test } from './fixtures';
import { TASK_BED_ID, seedGarden, taskSowingId, weeklyTasksGarden } from './garden';

const card = (page: Page) => page.getByRole('region', { name: 'Aufgaben' });
const tasks = (page: Page) => card(page).getByRole('listitem');

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, weeklyTasksGarden);
});

test('lists the tasks of the week on the raising page and checks them off', async ({ page }) => {
  await open(page, '/anzucht', 'Anzucht');
  await expect(card(page)).toContainText('KW 41 · 5. – 11. Oktober 2026');
  // Overdue first, then the batches by week and name, then the bed.
  await expect(tasks(page)).toHaveText([
    /^Kohlrabi aussäen\s*Überfällig\s*8 Samen, geplant für KW 40$/,
    /^Kopfsalat aussäen\s*12 Samen, geplant für KW 41$/,
    /^Tomate pikieren\s*Gesät in KW 39, pikieren nach 2 Wochen$/,
    /^Kopfsalat abhärten\s*Auspflanzen ab KW 42$/,
    /^Direkt säen in „Beet Herbst“\s*7 × Spinat$/,
    /^Pflanzen setzen in „Beet Herbst“\s*Jungpflanzen besorgen: 1 × Grünkohl$/,
  ]);

  // Next week only what newly comes up: the lettuce goes out.
  await card(page).getByRole('button', { name: 'Nächste Woche' }).click();
  await expect(card(page)).toContainText('KW 42 · 12. – 18. Oktober 2026');
  await expect(tasks(page)).toHaveText([/^Auspflanzen in „Beet Herbst“\s*3 × Kopfsalat$/]);
  await card(page).getByRole('button', { name: 'Diese Woche' }).click();

  // Checking a task off moves its batch on, and the task leaves the list (so a click, as
  // `check()` would look for the checked box).
  const steps = [
    ['Kopfsalat aussäen', taskSowingId(1), 'Weiter: Gekeimt'],
    ['Tomate pikieren', taskSowingId(3), 'Weiter: Abhärten'],
    ['Kopfsalat abhärten', taskSowingId(4), 'Abschließen'],
  ] as const;
  for (const [name, id, action] of steps) {
    await card(page).getByRole('checkbox', { name }).click();
    await expect(card(page).getByRole('checkbox', { name })).toHaveCount(0);
    await expect(
      page.getByTestId(`sowing-${id}`).getByRole('button', { name: action }),
    ).toBeVisible();
  }
  await expect(page.getByTestId(`sowing-${taskSowingId(4)}`)).toContainText('Abhärten');
  await expect(tasks(page)).toHaveCount(3);

  // The changes are stored: after reloading only the rest is left.
  await page.reload();
  await expect(tasks(page)).toHaveText([/^Kohlrabi aussäen/, /^Direkt säen/, /^Pflanzen setzen/]);
});

test('shows the beds first in the bed overview and opens the editor on the week', async ({
  page,
}) => {
  await open(page, '/beete', 'Meine Beete');
  // Compact: no details, the first four tasks, the rest on the raising page.
  await expect(tasks(page)).toHaveText([
    'Direkt säen in „Beet Herbst“',
    'Pflanzen setzen in „Beet Herbst“',
    /^Kohlrabi aussäen\s*Überfällig$/,
    'Kopfsalat aussäen',
  ]);
  await expect(
    card(page).getByRole('link', { name: '2 weitere Aufgaben in der Anzucht' }),
  ).toHaveAttribute('href', '/anzucht');

  await card(page).getByRole('button', { name: 'Nächste Woche' }).click();
  await card(page).getByRole('link', { name: 'Auspflanzen in „Beet Herbst“' }).click();
  await expect(page).toHaveURL(new RegExp(`/beete/${TASK_BED_ID}\\?woche=2026-10-12$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Beet Herbst' })).toBeVisible();
  await expect(page.getByTestId('week-label')).toHaveText('12. – 18. Oktober 2026 · KW 42');
});

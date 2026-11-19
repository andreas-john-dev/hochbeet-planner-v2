import type { Page } from '@playwright/test';
import { requestSuggestions } from './assistant-helpers';
import { expect, open, signInAs, test, USERS } from './fixtures';
import {
  bed,
  EXAMPLE_BED_ID,
  exampleGarden,
  type Garden,
  MOCK_API_KEY,
  planting,
  PLANTS,
  seedGarden,
} from './garden';

// The bed editor in the simple view (T-75): the current week only, no timeline, no dates,
// only the spatial rules; new plantings start this week, removing keeps the history.

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const OLD_TOMATO_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T01';
const TOMATO_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T02';
const CHIVES_ID = '01J9ZQ3W8D6V2K5M7N8P9R0T03';

const simpleGarden = (plantings: unknown[]): Garden => ({
  beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)],
  plantings,
  view: 'SIMPLE',
});

interface StoredPlanting {
  id: string;
  plantId: string;
  startDate: string;
  endDate: string | null;
  removedDate: string | null;
}

/** The plantings the mock API saved for the test user (or `email`). */
const storedPlantings = (page: Page, email: string = USERS.user.email) =>
  page.evaluate(
    ([key, user]) =>
      (
        JSON.parse(localStorage.getItem(key) ?? '{}') as Record<
          string,
          { plantings: StoredPlanting[] }
        >
      )[user]?.plantings ?? [],
    [MOCK_API_KEY, email] as const,
  );

const canvas = (page: Page) => page.getByTestId('bed-canvas');
const findings = (page: Page) => page.getByRole('list', { name: 'Hinweise' });

async function screenPoint(page: Page, cm: { x: number; y: number }) {
  const box = await page.getByTestId('bed-grid').boundingBox();
  if (!box) throw new Error('bed not drawn');
  const pxPerCm = box.width / 200;
  return { x: box.x + cm.x * pxPerCm, y: box.y + cm.y * pxPerCm };
}

/** Adds a plant at a point of the bed: palette and click, on phones sheet, tap and confirm. */
async function addPlant(page: Page, isMobile: boolean, name: string, cm: { x: number; y: number }) {
  const preview = page.getByTestId('placement-preview');
  if (isMobile) {
    await page.getByRole('button', { name: 'Pflanze hinzufügen' }).tap();
    const sheet = page.getByRole('dialog', { name: 'Pflanze hinzufügen' });
    await sheet.getByRole('searchbox', { name: 'Sorte suchen' }).fill(name);
    await sheet.getByRole('button', { name, exact: true }).tap();
    await expect(sheet).toBeHidden();
    await canvas(page).evaluate((el) => {
      el.scrollIntoView({ block: 'center' });
    });
    const at = await screenPoint(page, cm);
    await page.touchscreen.tap(at.x, at.y);
    await expect(preview).toHaveAttribute('data-x', String(cm.x));
    await page
      .getByRole('group', { name: 'Pflanze setzen' })
      .getByRole('button', { name: 'Hier pflanzen' })
      .tap();
  } else {
    const palette = page.getByRole('complementary', { name: 'Pflanzen hinzufügen' });
    await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill(name);
    await palette.getByRole('button', { name, exact: true }).click();
    const at = await screenPoint(page, cm);
    await page.mouse.click(at.x, at.y);
  }
  await expect(preview).toHaveCount(0);
}

/** Selects a planting in the bed; on phones its details open as a sheet. */
async function select(page: Page, isMobile: boolean, id: string) {
  const shape = page.getByTestId(`planting-${id}`);
  if (isMobile) await shape.tap();
  else await shape.click();
  await expect(page.getByRole('complementary', { name: /^Pflanzung / })).toBeVisible();
}

/** Switches the view in the editor: in the header on desktop, behind "Mehr" on phones. */
async function switchTo(page: Page, isMobile: boolean, name: 'Einfach' | 'Experte') {
  if (isMobile) {
    await page.getByRole('button', { name: 'Mehr', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Mehr' });
    await sheet.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  } else {
    await page
      .getByRole('group', { name: 'Einfach oder Experte' })
      .getByRole('button', { name })
      .click();
  }
}

const toolbarButton = (page: Page, name: 'Rückgängig' | 'Wiederholen') =>
  page.getByRole('toolbar', { name: 'Bearbeiten' }).getByRole('button', { name });

test('shows the bed without timeline, dates and origin', async ({ page, isMobile }) => {
  await signInAs(page, 'user');
  await seedGarden(
    page,
    simpleGarden([planting(CHIVES_ID, BED_ID, PLANTS.chives, { x: 50, y: 50 })]),
  );
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await expect(page.getByTestId(`planting-${CHIVES_ID}`)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Woche' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Woche wählen' })).toHaveCount(0);
  await expect(page.getByTestId('ghosts').locator('*')).toHaveCount(0);

  await select(page, isMobile, CHIVES_ID);
  const details = page.getByRole('complementary', { name: 'Pflanzung Schnittlauch' });
  await expect(details.getByText('Position')).toBeVisible();
  await expect(details.getByText('Gepflanzt')).toHaveCount(0);
  await expect(details.getByLabel('Ende anpassen')).toHaveCount(0);
  await expect(details.getByRole('group', { name: 'Ins Beet gekommen als' })).toHaveCount(0);
  await expect(details.getByRole('button', { name: /^Entfernen ab/ })).toHaveCount(0);
  await details.getByRole('button', { name: 'Auswahl aufheben' }).click();

  // The hint leads to the view switch: in the header, on phones in the menu.
  await page.getByRole('button', { name: 'Mehr Möglichkeiten in der Expertenansicht' }).click();
  if (isMobile) {
    await expect(page.getByRole('dialog', { name: 'Mehr' })).toBeVisible();
  } else {
    await expect(
      page.getByRole('group', { name: 'Einfach oder Experte' }).getByRole('button', {
        name: 'Experte',
      }),
    ).toBeFocused();
  }
});

test('warns about spacing and bad neighbours, not about crop rotation', async ({
  page,
  isMobile,
}) => {
  await signInAs(page, 'user');
  // A tomato on the spot of an earlier tomato of the same season: crop rotation in experts.
  await seedGarden(
    page,
    simpleGarden([
      planting(OLD_TOMATO_ID, BED_ID, PLANTS.tomato, {
        x: 50,
        y: 50,
        startDate: '2026-04-06',
        endDate: '2026-07-06',
      }),
      planting(TOMATO_ID, BED_ID, PLANTS.tomato, { x: 50, y: 50, startDate: '2026-07-06' }),
    ]),
  );
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await expect(page.getByTestId(`planting-${TOMATO_ID}`)).toBeVisible();
  await expect(page.getByTestId('findings-summary')).toHaveText('Keine Warnungen');

  // A second tomato too close, then a potato within 30 cm of it.
  await addPlant(page, isMobile, 'Tomate', { x: 90, y: 50 });
  await expect(findings(page)).toContainText('Tomate und Tomate stehen zu eng');
  await addPlant(page, isMobile, 'Kartoffel', { x: 160, y: 50 });
  await expect(findings(page)).toContainText('Kartoffel und Tomate sind schlechte Nachbarn.');
  await expect(findings(page)).not.toContainText('folgt am selben Platz');
  // The simple view shows the bed now, without periods ("KW 41 2026", "ab KW 41 2026").
  await expect(page.getByRole('heading', { name: 'Hinweise im Beet' })).toBeVisible();
  await expect(findings(page)).not.toContainText('KW');

  // The expert view knows the crop rotation of the same data.
  await switchTo(page, isMobile, 'Experte');
  await expect(findings(page)).toContainText('Tomate folgt am selben Platz direkt auf Tomate');
});

test('a planting placed in the simple view starts this week without an end', async ({
  page,
  isMobile,
}) => {
  await signInAs(page, 'user');
  await seedGarden(page, simpleGarden([]));
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await expect(page.getByTestId('findings-summary')).toHaveText('Keine Warnungen');

  await addPlant(page, isMobile, 'Kopfsalat', { x: 100, y: 50 });
  const lettuce = canvas(page).locator(`[data-plant-id="${PLANTS.lettuce}"]`);
  await expect(lettuce).toHaveCount(1);
  await expect
    .poll(() => storedPlantings(page))
    .toEqual([
      expect.objectContaining({
        plantId: PLANTS.lettuce,
        startDate: '2026-10-05',
        endDate: null,
        removedDate: null,
      }),
    ]);

  // Undo and redo the new planting.
  await toolbarButton(page, 'Rückgängig').click();
  await expect(lettuce).toHaveCount(0);
  await expect.poll(() => storedPlantings(page)).toEqual([]);
  await toolbarButton(page, 'Wiederholen').click();
  await expect(lettuce).toHaveCount(1);
  await expect.poll(async () => (await storedPlantings(page)).length).toBe(1);

  // In the expert view it starts in week 41 and has no own end.
  await switchTo(page, isMobile, 'Experte');
  await expect(page.getByRole('group', { name: 'Woche' })).toBeVisible();
  const id = (await storedPlantings(page))[0]?.id ?? '';
  await select(page, isMobile, id);
  const details = page.getByRole('complementary', { name: 'Pflanzung Kopfsalat' });
  await expect(details).toContainText('Mo., 5. Oktober 2026 (KW 41)');
  await expect(details.getByLabel('Ende anpassen')).toHaveValue('');
  await details.getByRole('button', { name: 'Auswahl aufheben' }).click();

  // Back in the simple view, removing a planting of this week deletes it.
  await switchTo(page, isMobile, 'Einfach');
  await select(page, isMobile, id);
  await page.getByRole('button', { name: 'Pflanzung entfernen' }).click();
  await expect(lettuce).toHaveCount(0);
  await expect.poll(() => storedPlantings(page)).toEqual([]);
});

test('an older planting removed in the simple view stays in the history up to last week', async ({
  page,
  isMobile,
}) => {
  await signInAs(page, 'user');
  await seedGarden(
    page,
    simpleGarden([planting(CHIVES_ID, BED_ID, PLANTS.chives, { x: 50, y: 50 })]),
  );
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  const chives = page.getByTestId(`planting-${CHIVES_ID}`);
  const removedDate = async () => (await storedPlantings(page))[0]?.removedDate;

  await select(page, isMobile, CHIVES_ID);
  await page.getByRole('button', { name: 'Pflanzung entfernen' }).click();
  await expect(chives).toHaveCount(0);
  await expect.poll(removedDate).toBe('2026-10-05');

  // Undo brings it back, redo removes it again.
  await toolbarButton(page, 'Rückgängig').click();
  await expect(chives).toBeVisible();
  await expect.poll(removedDate).toBeNull();
  await toolbarButton(page, 'Wiederholen').click();
  await expect(chives).toHaveCount(0);
  await expect.poll(removedDate).toBe('2026-10-05');

  // The expert view shows it up to the week before.
  await switchTo(page, isMobile, 'Experte');
  await expect(chives).toHaveCount(0);
  await page.getByRole('button', { name: 'Vorherige Woche' }).click();
  await expect(chives).toBeVisible();
});

test('the bed dialog has no soil renewals and keeps the stored ones', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, {
    ...simpleGarden([]),
    beds: [{ ...bed(BED_ID, 'Hochbeet Süd', 200, 100), soilRenewals: ['2026-07-06'] }],
  });
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await page.getByRole('button', { name: 'Beet bearbeiten' }).click();
  const dialog = page.getByRole('dialog', { name: 'Beet bearbeiten' });
  await expect(dialog.getByLabel('Name')).toHaveValue('Hochbeet Süd');
  await expect(dialog.getByRole('group', { name: 'Erde erneuert' })).toHaveCount(0);
  await dialog.getByLabel('Name').fill('Hochbeet Nord');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Hochbeet Nord', level: 1 })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        ([key, user]) =>
          (
            JSON.parse(localStorage.getItem(key) ?? '{}') as Record<
              string,
              { beds: { soilRenewals: string[] }[] }
            >
          )[user]?.beds[0]?.soilRenewals,
        [MOCK_API_KEY, USERS.user.email] as const,
      ),
    )
    .toEqual(['2026-07-06']);
});

test('suggestions of the assistant taken over in the simple view start this week without an end', async ({
  page,
}) => {
  const LETTUCE = '01M49THV00RK9E9PC83NEE87CJ';
  const RADISH = '01M49THV00NAC3VGAMQF7XGNWF';
  await signInAs(page, 'admin');
  await seedGarden(page, { ...exampleGarden, view: 'SIMPLE' }, USERS.admin.email);
  await open(page, `/beete/${EXAMPLE_BED_ID}`, 'Hochbeet Süd');
  await requestSuggestions(page);
  await page.getByRole('button', { name: 'Alle übernehmen' }).click();
  await expect(page.getByRole('region', { name: 'Pflanzvorschläge im Beet' })).toBeHidden();

  const adopted = async () =>
    (await storedPlantings(page, USERS.admin.email))
      .filter((p) => [LETTUCE, RADISH].includes(p.plantId))
      .map(({ plantId, startDate, endDate, removedDate }) => ({
        plantId,
        startDate,
        endDate,
        removedDate,
      }))
      .sort((a, b) => a.plantId.localeCompare(b.plantId));
  // The lifecycle decides the end, as for plantings placed by hand in the simple view.
  await expect
    .poll(adopted)
    .toEqual(
      [LETTUCE, RADISH]
        .sort()
        .map((plantId) => ({ plantId, startDate: '2026-10-05', endDate: null, removedDate: null })),
    );
});

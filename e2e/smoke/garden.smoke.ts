import { expect, type Page, test } from '@playwright/test';

// Signed-in smoke test against prod with the dedicated smoke user (created by
// SharedStatefulStack when the deploy passes SMOKE_USER_PASSWORD). Every bed it creates is
// deleted again, also when the test fails; leftovers of aborted runs go first.

const email = process.env.SMOKE_USER_EMAIL;
const password = process.env.SMOKE_USER_PASSWORD;
/** Deploy runs never overlap (concurrency group), so the run id makes the bed unique. */
const BED_PREFIX = 'Smoke ';
const bedName = `${BED_PREFIX}${process.env.GITHUB_RUN_ID ?? 'lokal'}`;

/** Deletes the beds whose name matches through the bed overview, as a user would. */
async function deleteBeds(page: Page, matches: (name: string) => boolean) {
  const names = await bedNames(page);
  for (const name of names.filter(matches)) {
    await page.getByRole('button', { name: `Beet „${name}“ löschen` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Beet löschen' }).click();
    await expect(page.getByRole('article', { name, exact: true })).toHaveCount(0);
  }
}

/** Names of the user's beds, read from the overview once it has loaded. */
async function bedNames(page: Page): Promise<string[]> {
  await page.goto('/beete');
  await expect(page.getByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page
      .getByRole('article')
      .or(page.getByRole('heading', { name: 'Noch keine Beete' }))
      .first(),
  ).toBeVisible({ timeout: 20_000 });
  return page.getByRole('article').evaluateAll((cards) =>
    cards.map((card) => {
      const label = card.getAttribute('aria-labelledby');
      return (label && document.getElementById(label)?.textContent.trim()) ?? '';
    }),
  );
}

test.describe('signed in as the smoke user', () => {
  test.skip(!email || !password, 'SMOKE_USER_EMAIL and SMOKE_USER_PASSWORD are not set');

  test('creates a bed, plants, sees a warning and leaves no data behind', async ({
    page,
    isMobile,
  }) => {
    // One project is enough: both would write with the same user.
    test.skip(isMobile, 'Runs on desktop only.');
    test.setTimeout(120_000);

    await page.goto('/anmelden');
    await page.getByLabel('E-Mail').fill(email ?? '');
    await page.getByLabel('Passwort', { exact: true }).fill(password ?? '');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible({
      timeout: 20_000,
    });
    // Leftovers of an aborted earlier run.
    await deleteBeds(page, (name) => name.startsWith(BED_PREFIX));

    try {
      // Beet anlegen
      // "Erstes Beet anlegen" while the user has no beds, "Beet anlegen" otherwise.
      await page
        .getByRole('button', { name: /^(Erstes )?Beet anlegen$/ })
        .first()
        .click();
      const dialog = page.getByRole('dialog', { name: 'Beet anlegen' });
      await dialog.getByLabel('Name').fill(bedName);
      await dialog.getByRole('button', { name: 'Beet anlegen' }).click();
      await expect(dialog).toBeHidden();
      await page.getByRole('link', { name: bedName }).click();
      await expect(page.getByRole('heading', { level: 1, name: bedName })).toBeVisible();

      // Pflanzen setzen: tomato and potato in the middle of the bed, by keyboard.
      const palette = page.getByRole('complementary', { name: 'Pflanzen hinzufügen' });
      for (const plant of ['Tomate', 'Kartoffel']) {
        await palette.getByRole('searchbox', { name: 'Sorte suchen' }).fill(plant);
        await palette.getByRole('button', { name: plant, exact: true }).click();
        await expect(page.getByTestId('bed-canvas')).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('placement-preview')).toHaveCount(0);
      }
      await expect(page.locator('[data-testid^="planting-"]')).toHaveCount(2);

      // Warnung sehen, and still there after a reload: the plantings were saved.
      const findings = page.getByRole('list', { name: 'Hinweise' });
      await expect(findings).toContainText('Kartoffel und Tomate sind schlechte Nachbarn.');
      await page.reload();
      await expect(findings).toContainText('Kartoffel und Tomate sind schlechte Nachbarn.');

      // Zeitachse: a week later both are still in the bed.
      await page.getByRole('button', { name: 'Nächste Woche' }).click();
      await expect(page.locator('[data-testid^="planting-"]')).toHaveCount(2);
    } finally {
      // Cleans up also when a step above failed.
      await deleteBeds(page, (name) => name === bedName);
    }
    expect(await bedNames(page)).not.toContain(bedName);
  });
});

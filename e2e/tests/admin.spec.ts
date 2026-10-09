import { expect, open, signInAs, test, USERS } from './fixtures';
import { ownPlant, PENDING_ID, pendingRequest, seedGarden } from './garden';

const REQUESTER = 'gaertner@example.com';
const REJECTED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0P11';

/** Switches the mock session to another user; the next page load is signed in as them. */
async function signInAgainAs(page: Parameters<typeof open>[0], email: string) {
  await page.evaluate(
    ([key, session]) => {
      localStorage.setItem(key, JSON.stringify({ session }));
    },
    ['hochbeet-mock-auth', email] as const,
  );
}

test('approves a request with a correction; the plant then shows up for another user', async ({
  page,
}) => {
  await signInAs(page, 'admin');
  // The request comes from a third user; admin and test user only see it after approval.
  await seedGarden(page, { beds: [], plantings: [], ownPlants: [pendingRequest] }, REQUESTER);
  await open(page, '/admin', 'Administration');
  const queue = page.getByRole('list', { name: 'Anfragen' });
  await expect(queue.getByRole('link')).toHaveCount(1);
  await queue.getByRole('link', { name: /Eichblattsalat/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Anfrage prüfen' })).toBeVisible();

  // Compared with similar global plants: same name part and family first.
  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader')).toContainText([
    '',
    'Eichblattsalat (Anfrage)',
    'Kopfsalat',
    'Pflücksalat',
  ]);
  await expect(page).toHaveScreenshot('review.png', { fullPage: true });

  // Correct the culture before approving.
  await page.getByLabel('Kulturdauer (Wochen)').fill('8');
  await page.getByRole('button', { name: 'Freigeben' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible();
  await expect(page.getByText('Keine offenen Anfragen')).toBeVisible();
  await expect(
    page
      .getByRole('list', { name: 'Globale Sorten' })
      .getByRole('link', { name: /Eichblattsalat/ }),
  ).toBeVisible();

  // Another user now finds it in the catalogue, as a global plant with the corrected value.
  await signInAgainAs(page, USERS.user.email);
  await open(page, `/katalog/${PENDING_ID}`, 'Eichblattsalat');
  await expect(page.getByText('8 Wochen', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Für mich anpassen' })).toBeVisible();
  await open(page, '/katalog', 'Pflanzenkatalog');
  await page.getByRole('searchbox', { name: 'Sorte oder Familie suchen' }).fill('Eichblatt');
  await expect(page.getByRole('list', { name: 'Sorten' }).getByRole('link')).toHaveText([
    /^Eichblattsalat/,
  ]);
});

test('rejects a request with a comment that the requester sees', async ({ page }) => {
  await signInAs(page, 'admin');
  await seedGarden(
    page,
    {
      beds: [],
      plantings: [],
      ownPlants: [
        ownPlant(REJECTED_ID, 'Endivien-Salat', {
          publication: { status: 'PENDING' },
          requestedAt: '2026-10-06',
        }),
      ],
    },
    USERS.user.email,
  );
  await open(page, `/admin/anfragen/${REJECTED_ID}`, 'Anfrage prüfen');
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await expect(page.getByText('Bitte begründe die Ablehnung.')).toBeVisible();
  await page.getByLabel('Begründung für die Ablehnung').fill('Gibt es schon als Endivie.');
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await expect(page.getByText('Keine offenen Anfragen')).toBeVisible();

  await signInAgainAs(page, USERS.user.email);
  await open(page, `/katalog/${REJECTED_ID}`, 'Endivien-Salat');
  const status = page.getByTestId('publication');
  await expect(status).toHaveAttribute('data-state', 'rejected');
  await expect(status).toContainText('Gibt es schon als Endivie.');
});

test('creates and changes a global plant', async ({ page }) => {
  await signInAs(page, 'admin');
  await open(page, '/admin', 'Administration');
  await page.getByRole('link', { name: 'Globale Sorte anlegen' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Globale Sorte anlegen' }),
  ).toBeVisible();
  await page.getByLabel('Name').fill('Yacon');
  await page.getByLabel('Familie').fill('Korbblütler');
  await page.getByLabel('Abstand in der Reihe (cm)').fill('60');
  await page.getByLabel('Reihenabstand (cm)').fill('80');
  await page.getByLabel('Kulturdauer (Wochen)').fill('26');
  await page.getByRole('button', { name: 'Sorte anlegen' }).click();

  const globals = page.getByRole('list', { name: 'Globale Sorten' });
  await globals.getByRole('link', { name: /Yacon/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Globale Sorte bearbeiten' }),
  ).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Yacon');
  await page.getByLabel('Name').fill('Yacón');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(globals.getByRole('link', { name: /Yacón/ })).toBeVisible();

  // Everyone sees the global plant.
  await signInAgainAs(page, USERS.user.email);
  await open(page, '/katalog', 'Pflanzenkatalog');
  await page.getByRole('searchbox', { name: 'Sorte oder Familie suchen' }).fill('Yac');
  await expect(page.getByRole('list', { name: 'Sorten' }).getByRole('link')).toHaveText([/^Yacón/]);
});

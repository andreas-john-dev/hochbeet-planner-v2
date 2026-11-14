import { expect, open, signInAs, test } from './fixtures';
import { bed, PLANTS, planting, seedGarden, sowing, sowingId } from './garden';

// Findings of the rule engine and week labels in English. Plant names stay German until the
// catalogue gets English names (T-71).
test.use({ language: 'en' });

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';

test('shows a spacing warning and the week in English in the editor', async ({ page }) => {
  await signInAs(page, 'user');
  // Two tomatoes 30 cm apart, planted this week (week 41); each needs 60 cm.
  await seedGarden(page, {
    beds: [bed(BED_ID, 'South bed', 200, 100)],
    plantings: [
      planting('01J9ZQ3W8D6V2K5M7N8P9R0T01', BED_ID, PLANTS.tomato, {
        x: 60,
        y: 50,
        startDate: '2026-10-05',
      }),
      planting('01J9ZQ3W8D6V2K5M7N8P9R0T02', BED_ID, PLANTS.tomato, {
        x: 90,
        y: 50,
        startDate: '2026-10-05',
      }),
    ],
  });
  await open(page, `/beete/${BED_ID}`, 'South bed');

  await expect(page.getByTestId('findings-summary')).toContainText('1 warning');
  await expect(page.getByRole('list', { name: 'Hints' })).toContainText(
    /Tomate and Tomate are too close: their footprints overlap by \d+ cm\./,
  );
  await expect(page.getByText('5 – 11 October 2026 · Week 41').first()).toBeVisible();
});

test('shows findings at a batch in English, in the editor and on the seedlings page', async ({
  page,
}) => {
  await signInAs(page, 'user');
  await seedGarden(page, {
    beds: [{ ...bed(BED_ID, 'South bed', 200, 100), mainRowDirection: 'H' }],
    // A row of 125 cm holds 6 lettuces, but only 4 seedlings are alive.
    plantings: [
      planting('01J9ZQ3W8D6V2K5M7N8P9R0PA1', BED_ID, PLANTS.lettuce, {
        x: 40,
        y: 20,
        startDate: '2026-10-05',
        sowingId: sowingId(1),
        kind: 'ROW',
        orientation: 'H',
        lengthCm: 125,
      }),
    ],
    sowings: [
      sowing(sowingId(1), PLANTS.lettuce, {
        sowDate: '2026-09-07',
        aliveCount: 4,
        stage: 'HARDENING',
      }),
    ],
  });
  await open(page, `/beete/${BED_ID}`, 'South bed');
  await expect(page.getByRole('list', { name: 'Hints' })).toContainText(
    'Seedlings of Kopfsalat (week 37): 6 planned, but only 4 available.',
  );

  await open(page, '/anzucht', 'Seedlings');
  const card = page.getByRole('article', { name: 'Kopfsalat' });
  await expect(card).toContainText('Week 37 · 7 – 13 September 2026');
  await expect(card.getByRole('list', { name: 'Notes on this batch' })).toContainText(
    'More planned in beds than available: 6 planned, but only 4 available.',
  );
});

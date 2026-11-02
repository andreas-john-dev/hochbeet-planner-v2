import { expect, open, signInAs, test } from './fixtures';
import { bed, PLANTS, planting, seedGarden, sowing, sowingId } from './garden';

const BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const lettuces = (startDate: string, extra: Record<string, unknown> = {}) =>
  planting('01J9ZQ3W8D6V2K5M7N8P9R0PA1', BED_ID, PLANTS.lettuce, {
    x: 40,
    y: 20,
    startDate,
    sowingId: sowingId(1),
    ...extra,
  });

test('warns at lettuce planted out two weeks after sowing', async ({ page }) => {
  await signInAs(page, 'user');
  await seedGarden(page, {
    beds: [bed(BED_ID, 'Hochbeet Süd', 200, 100)],
    // Sown in KW 39, planted out in KW 41: Kopfsalat needs 3–4 weeks of raising.
    plantings: [lettuces('2026-10-05')],
    sowings: [sowing(sowingId(1), PLANTS.lettuce, { sowDate: '2026-09-21', stage: 'HARDENING' })],
  });
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');

  await expect(page.getByRole('list', { name: 'Hinweise' })).toContainText(
    'Kopfsalat wurde nach 2 Wochen Anzucht ausgepflanzt, braucht aber mindestens 3 Wochen.',
  );
  await expect(page.locator(`[data-plant-id="${PLANTS.lettuce}"]`)).toHaveAttribute(
    'data-status',
    'warning',
  );
});

test('warns in the editor and on the sowing page when more is planned than alive', async ({
  page,
}) => {
  await signInAs(page, 'user');
  await seedGarden(page, {
    beds: [{ ...bed(BED_ID, 'Hochbeet Süd', 200, 100), mainRowDirection: 'H' }],
    // A row of 125 cm holds 6 lettuces, but only 4 seedlings are alive.
    plantings: [lettuces('2026-10-05', { kind: 'ROW', orientation: 'H', lengthCm: 125 })],
    sowings: [
      sowing(sowingId(1), PLANTS.lettuce, {
        sowDate: '2026-09-07',
        aliveCount: 4,
        stage: 'HARDENING',
      }),
    ],
  });
  await open(page, `/beete/${BED_ID}`, 'Hochbeet Süd');
  await expect(page.getByRole('list', { name: 'Hinweise' })).toContainText(
    'Aus der Anzucht Kopfsalat (KW 37) sind 6 verplant, aber nur 4 vorhanden.',
  );
  await expect(page.locator(`[data-plant-id="${PLANTS.lettuce}"]`)).toHaveAttribute(
    'data-status',
    'warning',
  );

  await open(page, '/anzucht', 'Anzucht');
  const card = page.getByRole('article', { name: 'Kopfsalat' });
  await expect(card.getByTestId('stock')).toHaveText('lebend 4 · verplant 6 · frei −2');
  await expect(card.getByRole('list', { name: 'Hinweise zur Anzucht' })).toContainText(
    'Mehr in Beeten verplant als vorhanden: 6 verplant, aber nur 4 vorhanden.',
  );
});

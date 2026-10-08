import type { Page } from '@playwright/test';
import { USERS } from './fixtures';

const MOCK_API_KEY = 'hochbeet-mock-api';

export interface Garden {
  beds: unknown[];
  plantings: unknown[];
  /** Own plants as the catalogue lists them (`source: 'OWN'`, with `publication`). */
  ownPlants?: unknown[];
}

/** Seeds the mock API with beds and plantings for a test user (default: the normal user). */
export async function seedGarden(page: Page, garden: Garden, email: string = USERS.user.email) {
  await page.addInitScript(
    ([key, user, data]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ [user]: data }));
    },
    [MOCK_API_KEY, email, garden] as const,
  );
}

/** Seed plant IDs from packages/catalog-seed. */
export const PLANTS = {
  kale: '01M49THV00A6TVTS7JDM60G9YY', // Grünkohl, 30 weeks
  chard: '01M49THV00PAF8V0RQKEJ6T6FT', // Mangold, 20 weeks
  rosemary: '01M49THV0088BETVBD9HZY3BH3', // Rosmarin, perennial
  leek: '01M49THV00BS8T7Z8ZDSW03PXH', // Lauch, 22 weeks, 15 cm
  beetroot: '01M49THV007QZ49TY1XCYCQ54J', // Rote Bete, 14 weeks, 10 cm
  spinach: '01M49THV009C9ACEM9APGSMT4E', // Spinat, 8 weeks, 10 cm
  parsley: '01M49THV00W2T9ZJHHDX8H5YMY', // Petersilie, 30 weeks
  chives: '01M49THV00JTGP22ZW0RKZZT9K', // Schnittlauch, perennial
  thyme: '01M49THV00Y146B7QH3XHMRCBA', // Thymian, perennial
} as const;

export const bed = (id: string, name: string, widthCm: number, depthCm: number) => ({
  id,
  name,
  widthCm,
  depthCm,
  mainRowDirection: widthCm >= depthCm ? 'V' : 'H',
  soilRenewals: [],
});

export const planting = (
  id: string,
  bedId: string,
  plantId: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  bedId,
  plantId,
  kind: 'SINGLE',
  x: 0,
  y: 0,
  startDate: '2026-05-04',
  endDate: null,
  removedDate: null,
  ...extra,
});

export const EXAMPLE_BED_ID = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
export const exampleId = (n: number) => `01J9ZQ3W8D6V2K5M7N8P9R0T${String(n).padStart(2, '0')}`;

// 2 × 1 m with 8 plantings that are all in the bed on 7 October 2026 (fixed clock).
export const exampleGarden: Garden = {
  beds: [bed(EXAMPLE_BED_ID, 'Hochbeet Süd', 200, 100)],
  plantings: [
    planting(exampleId(1), EXAMPLE_BED_ID, PLANTS.chives, { x: 15, y: 15 }),
    planting(exampleId(2), EXAMPLE_BED_ID, PLANTS.thyme, { x: 15, y: 50 }),
    planting(exampleId(3), EXAMPLE_BED_ID, PLANTS.parsley, { x: 15, y: 85 }),
    planting(exampleId(4), EXAMPLE_BED_ID, PLANTS.kale, { x: 50, y: 50 }),
    planting(exampleId(5), EXAMPLE_BED_ID, PLANTS.chard, {
      kind: 'ROW',
      x: 90,
      y: 25,
      orientation: 'H',
      lengthCm: 30,
      startDate: '2026-06-01',
    }),
    planting(exampleId(6), EXAMPLE_BED_ID, PLANTS.leek, {
      kind: 'ROW',
      x: 85,
      y: 75,
      orientation: 'H',
      lengthCm: 45,
      startDate: '2026-06-15',
    }),
    planting(exampleId(7), EXAMPLE_BED_ID, PLANTS.beetroot, {
      kind: 'ROW',
      x: 160,
      y: 10,
      orientation: 'V',
      lengthCm: 80,
      startDate: '2026-08-03',
    }),
    planting(exampleId(8), EXAMPLE_BED_ID, PLANTS.spinach, {
      kind: 'ROW',
      x: 185,
      y: 10,
      orientation: 'V',
      lengthCm: 80,
      startDate: '2026-09-07',
    }),
  ],
};

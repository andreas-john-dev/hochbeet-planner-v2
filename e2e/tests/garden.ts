import type { Page } from '@playwright/test';
import { USERS } from './fixtures';

const MOCK_API_KEY = 'hochbeet-mock-api';

/** Seeds the mock API with beds and plantings for the signed-in test user. */
export async function seedGarden(page: Page, garden: { beds: unknown[]; plantings: unknown[] }) {
  await page.addInitScript(
    ([key, user, data]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ [user]: data }));
    },
    [MOCK_API_KEY, USERS.user.email, garden] as const,
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

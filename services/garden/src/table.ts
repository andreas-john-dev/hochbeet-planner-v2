/**
 * Key design of the garden table (docs/architecture.md, "Garden-Service"). The user is part
 * of every key, so a query can never reach another user's beds.
 */
export const gardenTable = { partitionKey: 'PK', sortKey: 'SK' } as const;

export const userPk = (userId: string) => `USER#${userId}`;
export const BED_PREFIX = 'BED#';
export const PLANTING_INFIX = '#PLANTING#';
export const bedSk = (bedId: string) => `${BED_PREFIX}${bedId}`;
export const plantingSk = (bedId: string, plantingId: string) =>
  `${bedSk(bedId)}${PLANTING_INFIX}${plantingId}`;

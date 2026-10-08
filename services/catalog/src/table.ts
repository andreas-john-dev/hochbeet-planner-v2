/**
 * Key design of the catalog table (docs/architecture.md, "Catalog-Service").
 * Infra creates the table from these names; the service builds keys with the helpers.
 */
export const catalogTable = {
  partitionKey: 'PK',
  sortKey: 'SK',
  /** Publication queue for admins: GSI1PK = PUBLICATION#PENDING, GSI1SK = requested at. */
  publicationIndex: { name: 'GSI1', partitionKey: 'GSI1PK', sortKey: 'GSI1SK' },
} as const;

export const GLOBAL_PK = 'GLOBAL';
export const plantSk = (plantId: string) => `PLANT#${plantId}`;
export const userPk = (userId: string) => `USER#${userId}`;
export const overrideSk = (plantId: string) => `OVERRIDE#${plantId}`;
export const PLANT_PREFIX = 'PLANT#';
export const OVERRIDE_PREFIX = 'OVERRIDE#';

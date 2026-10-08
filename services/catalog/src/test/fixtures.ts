import { seedPlants } from '@hochbeet/catalog-seed';
import type { Plant } from '@hochbeet/contracts';
import type { ApiEvent } from '../user';

export const USER_A = 'a1b2c3d4-0000-4000-8000-00000000000a';
export const USER_B = 'a1b2c3d4-0000-4000-8000-00000000000b';

export const seedPlant = (name: string): Plant => {
  const plant = seedPlants.find((p) => p.name === name);
  if (!plant) throw new Error(`No seed plant ${name}`);
  return plant;
};

/** An own plant of a user, based on a seed plant but with a new id and name. */
export const ownPlant = (id: string, name: string): Plant => ({
  ...seedPlant('Tomate'),
  id,
  name,
  goodNeighbors: [],
  badNeighbors: [],
});

/** Lambda bindings as the HTTP API JWT authorizer passes them. */
export const authorized = (sub: string, groups?: string) => ({
  event: {
    requestContext: {
      requestId: 'req-1',
      authorizer: { jwt: { claims: { sub, ...(groups ? { 'cognito:groups': groups } : {}) } } },
    },
  } satisfies ApiEvent,
});

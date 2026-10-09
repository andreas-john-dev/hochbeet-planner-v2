import {
  ApprovePublicationRequestSchema,
  type CatalogPlant,
  type ListPublicPlantsResponse,
  type Plant,
  type PlantFields,
  type PublicationQueueResponse,
  RejectPublicationRequestSchema,
  SavePlantRequestSchema,
} from '@hochbeet/contracts';
import { ulid } from 'ulid';
import {
  GLOBAL_NEIGHBORS_ONLY,
  idsOf,
  listed,
  neighborIssues,
  PLANT_NOT_FOUND,
} from '@/lib/local-api/routes';
import { error, json, noContent, parseJson, route, type Route } from '@/lib/local-api/router';
import type { LocalGarden, OwnPlant } from '@/lib/local-api/store';
import type { MockStore } from './store';

export interface MockUser {
  id: string;
  admin: boolean;
}

/**
 * User and groups from the mock ID token (`mock-id-token.<email>` or
 * `mock-id-token.<email>|admins`), like `sub` and `cognito:groups` in the real services.
 */
export function userOf(request: Request): MockUser | undefined {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token?.startsWith('mock-id-token.')) return undefined;
  const [id = '', groups = ''] = token.slice('mock-id-token.'.length).split('|');
  return { id, admin: groups.split(',').includes('admins') };
}

const NO_REQUEST = 'Für diese Sorte gibt es keine offene Anfrage.';
/** The plant fields of an own plant, without id and catalogue metadata. */
const fieldsOf = (plant: OwnPlant): PlantFields => SavePlantRequestSchema.parse(plant);

/** Routes without sign-in: the global catalogue for guests, like the catalog service. */
export function publicRoutes(store: MockStore): Route[] {
  return [
    route('GET', '/api/catalog/public/plants', () =>
      json<ListPublicPlantsResponse>({
        plants: [...store.readCatalog()].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      }),
    ),
  ];
}

/**
 * The parts of the catalog service that span users and exist only for signed-in users: the
 * publication workflow and the admin routes. Everything else comes from `localRoutes()`.
 */
export function mockRoutes(
  store: MockStore,
  user: MockUser,
  newId: () => string = () => ulid(),
): Route[] {
  // Like the catalog service: /admin/* only for the Cognito group `admins`.
  const admin =
    (handler: Route['handler']): Route['handler'] =>
    (args) =>
      user.admin ? handler(args) : error('Dieser Bereich ist nur für Admins.', 403);
  const pendingRequest = (plantId: string | undefined) => {
    for (const [userId, garden] of store.users()) {
      const plant = garden.ownPlants?.find(
        (p) => p.id === plantId && !p.archived && p.publication?.status === 'PENDING',
      );
      if (plant) return { userId, garden, plant };
    }
    return undefined;
  };
  const replaceOwn = (userId: string, garden: LocalGarden, plant: OwnPlant) => {
    store.write(userId, {
      ...garden,
      ownPlants: (garden.ownPlants ?? []).map((p) => (p.id === plant.id ? plant : p)),
    });
  };

  return [
    route('POST', '/api/catalog/plants/:id/publication', ({ params }) => {
      const garden = store.read(user.id);
      const existing = garden.ownPlants?.find((p) => p.id === params.id && !p.archived);
      if (!existing) return error(PLANT_NOT_FOUND, 404);
      const status = existing.publication?.status;
      if (status === 'PUBLISHED') return error('Diese Sorte ist bereits veröffentlicht.', 409);
      if (status === 'PENDING') return json<CatalogPlant>(listed(existing));
      const issues = neighborIssues(
        existing,
        existing.id,
        idsOf(store.readCatalog()),
        GLOBAL_NEIGHBORS_ONLY,
      );
      if (issues.length > 0) return error('Bitte prüfe die Nachbarn.', 400, issues);
      const plant: OwnPlant = {
        ...existing,
        publication: { status: 'PENDING' },
        requestedAt: new Date().toISOString().slice(0, 10),
      };
      replaceOwn(user.id, garden, plant);
      return json<CatalogPlant>(listed(plant));
    }),

    route(
      'GET',
      '/api/catalog/admin/publications',
      admin(() =>
        json<PublicationQueueResponse>({
          requests: store
            .users()
            .flatMap(([userId, garden]) =>
              (garden.ownPlants ?? [])
                .filter((p) => !p.archived && p.publication?.status === 'PENDING')
                .map((p) => ({
                  plant: { ...fieldsOf(p), id: p.id },
                  requestedBy: userId,
                  requestedAt: p.requestedAt ?? '',
                })),
            )
            .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)),
        }),
      ),
    ),

    route(
      'POST',
      '/api/catalog/admin/publications/:id/approve',
      admin(async ({ request, params }) => {
        const parsed = await parseJson(request, ApprovePublicationRequestSchema);
        if (parsed.response) return parsed.response;
        const pending = pendingRequest(params.id);
        if (!pending) return error(NO_REQUEST, 404);
        const plant: Plant = {
          ...fieldsOf(pending.plant),
          ...parsed.data.corrections,
          id: pending.plant.id,
        };
        const globals = store.readCatalog();
        const issues = neighborIssues(plant, plant.id, idsOf(globals), GLOBAL_NEIGHBORS_ONLY);
        if (issues.length > 0) return error('Bitte prüfe die Nachbarn.', 400, issues);
        // Same id as before: plantings that use the plant keep working.
        store.writeCatalog([...globals, plant]);
        const { requestedAt: _requestedAt, ...rest } = pending.plant;
        replaceOwn(pending.userId, store.read(pending.userId), {
          ...rest,
          publication: { status: 'PUBLISHED' },
        });
        return json<Plant>(plant);
      }),
    ),

    route(
      'POST',
      '/api/catalog/admin/publications/:id/reject',
      admin(async ({ request, params }) => {
        const parsed = await parseJson(request, RejectPublicationRequestSchema);
        if (parsed.response) return parsed.response;
        const pending = pendingRequest(params.id);
        if (!pending) return error(NO_REQUEST, 404);
        const { requestedAt: _requestedAt, ...rest } = pending.plant;
        replaceOwn(pending.userId, pending.garden, {
          ...rest,
          publication: { status: 'PRIVATE', rejectionComment: parsed.data.comment },
        });
        return noContent();
      }),
    ),

    route(
      'POST',
      '/api/catalog/admin/plants',
      admin(async ({ request }) => {
        const parsed = await parseJson(request, SavePlantRequestSchema);
        if (parsed.response) return parsed.response;
        const globals = store.readCatalog();
        const plant: Plant = { ...parsed.data, id: newId() };
        const issues = neighborIssues(plant, plant.id, idsOf(globals), GLOBAL_NEIGHBORS_ONLY);
        if (issues.length > 0) return error('Bitte prüfe die Nachbarn.', 400, issues);
        store.writeCatalog([...globals, plant]);
        return json<Plant>(plant, 201);
      }),
    ),

    route(
      'PUT',
      '/api/catalog/admin/plants/:id',
      admin(async ({ request, params }) => {
        const parsed = await parseJson(request, SavePlantRequestSchema);
        if (parsed.response) return parsed.response;
        const globals = store.readCatalog();
        if (!globals.some((p) => p.id === params.id)) return error(PLANT_NOT_FOUND, 404);
        const plant: Plant = { ...parsed.data, id: params.id ?? '' };
        const issues = neighborIssues(plant, plant.id, idsOf(globals), GLOBAL_NEIGHBORS_ONLY);
        if (issues.length > 0) return error('Bitte prüfe die Nachbarn.', 400, issues);
        store.writeCatalog(globals.map((p) => (p.id === plant.id ? plant : p)));
        return json<Plant>(plant);
      }),
    ),
  ];
}

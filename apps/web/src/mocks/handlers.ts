import { seedPlants } from '@hochbeet/catalog-seed';
import {
  type Bed,
  type BedWithPlantingsResponse,
  type CatalogPlant,
  type ErrorResponse,
  type ListBedsResponse,
  type ListPlantsResponse,
  type Plant,
  type Planting,
  type PlantFields,
  type PlantOverride,
  SaveBedRequestSchema,
  SaveOverrideRequestSchema,
  SavePlantingRequestSchema,
  SavePlantRequestSchema,
} from '@hochbeet/contracts';
import { http, HttpResponse } from 'msw';
import { ulid } from 'ulid';
import type { z } from 'zod';
import type { MockGarden, MockStore, OwnMockPlant } from './store';

const error = (message: string, status: number, issues?: ErrorResponse['issues']) =>
  HttpResponse.json<ErrorResponse>(issues ? { message, issues } : { message }, { status });

/** User from the mock ID token (`mock-id-token.<email>`), like `sub` in the real services. */
function userOf(request: Request): string | undefined {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  return token?.startsWith('mock-id-token.') ? token.slice('mock-id-token.'.length) : undefined;
}

async function parse<T extends z.ZodType>(request: Request, schema: T) {
  const result = schema.safeParse(await request.json().catch(() => undefined));
  return result.success
    ? { data: result.data }
    : {
        response: error(
          'Bitte prüfe deine Eingaben.',
          400,
          result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      };
}

const byName = (a: Bed, b: Bed) => a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id);
const BED_NOT_FOUND = 'Dieses Beet gibt es nicht.';
const PLANTING_NOT_FOUND = 'Diese Pflanzung gibt es nicht.';
const PLANT_NOT_FOUND = 'Diese Sorte gibt es nicht.';

/** A global plant as the user sees it, like the catalog service's effective catalogue. */
function effective(plant: Plant, override: PlantOverride | undefined): CatalogPlant {
  if (!override) return { ...plant, source: 'GLOBAL', overridden: false };
  const { id: _id, ...global } = plant;
  return { ...plant, ...override, id: plant.id, source: 'GLOBAL', overridden: true, global };
}

const GLOBAL_IDS = new Set(seedPlants.map((p) => p.id));

/** Like the catalog service: neighbours must be known plants and never the plant itself. */
function neighborIssues(fields: PlantFields, selfId: string, known: Set<string>, unknown: string) {
  return (['goodNeighbors', 'badNeighbors'] as const).flatMap((list) =>
    fields[list].flatMap((neighborId, index) => {
      const path = `${list}.${String(index)}`;
      if (neighborId === selfId)
        return [{ path, message: 'Eine Sorte kann nicht ihr eigener Nachbar sein.' }];
      return known.has(neighborId) ? [] : [{ path, message: unknown }];
    }),
  );
}

const ownKnown = (garden: MockGarden) =>
  new Set([...GLOBAL_IDS, ...(garden.ownPlants ?? []).filter((p) => !p.archived).map((p) => p.id)]);

const listed = ({ archived: _archived, ...plant }: OwnMockPlant): CatalogPlant => plant;

/**
 * MSW handlers that mimic the garden and catalog services for the dev server and
 * Playwright: same routes, schemas and error format, data per user in the mock store.
 */
export function createHandlers(store: MockStore, newId: () => string = () => ulid()) {
  const withUser =
    (
      resolve: (args: {
        request: Request;
        params: Record<string, string>;
        userId: string;
      }) => Promise<Response> | Response,
    ) =>
    ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
      const userId = userOf(request);
      if (!userId) return error('Bitte melde dich an.', 401);
      return resolve({ request, params: params as Record<string, string>, userId });
    };

  return [
    http.get(
      '/api/catalog/plants',
      withUser(({ userId }) => {
        const garden = store.read(userId);
        const overrides = garden.overrides ?? {};
        const own = (garden.ownPlants ?? [])
          .filter((p) => !p.archived && p.publication?.status !== 'PUBLISHED')
          .map(listed);
        return HttpResponse.json<ListPlantsResponse>({
          plants: [
            ...seedPlants.map((plant) => effective(plant, overrides[plant.id])),
            ...own,
          ].sort((a, b) => a.name.localeCompare(b.name, 'de')),
        });
      }),
    ),

    http.post(
      '/api/catalog/plants',
      withUser(async ({ request, userId }) => {
        const parsed = await parse(request, SavePlantRequestSchema);
        if (parsed.response) return parsed.response;
        const garden = store.read(userId);
        const id = newId();
        const issues = neighborIssues(parsed.data, id, ownKnown(garden), 'Unbekannte Sorte.');
        if (issues.length > 0) return error('Bitte prüfe die Nachbarn.', 400, issues);
        const plant: CatalogPlant = {
          ...parsed.data,
          id,
          source: 'OWN',
          overridden: false,
          publication: { status: 'PRIVATE' },
        };
        store.write(userId, { ...garden, ownPlants: [...(garden.ownPlants ?? []), plant] });
        return HttpResponse.json(plant, { status: 201 });
      }),
    ),

    http.put(
      '/api/catalog/plants/:id',
      withUser(async ({ request, params, userId }) => {
        const parsed = await parse(request, SavePlantRequestSchema);
        if (parsed.response) return parsed.response;
        const garden = store.read(userId);
        const existing = garden.ownPlants?.find((p) => p.id === params.id && !p.archived);
        if (!existing) return error(PLANT_NOT_FOUND, 404);
        const issues = neighborIssues(
          parsed.data,
          existing.id,
          ownKnown(garden),
          'Unbekannte Sorte.',
        );
        if (issues.length > 0) return error('Bitte prüfe die Nachbarn.', 400, issues);
        // Publication state is not part of the fields; it changes only through the workflow.
        const plant: OwnMockPlant = { ...existing, ...parsed.data, id: existing.id };
        store.write(userId, {
          ...garden,
          ownPlants: (garden.ownPlants ?? []).map((p) => (p.id === plant.id ? plant : p)),
        });
        return HttpResponse.json<CatalogPlant>(listed(plant));
      }),
    ),

    http.delete(
      '/api/catalog/plants/:id',
      withUser(({ params, userId }) => {
        const garden = store.read(userId);
        if (!garden.ownPlants?.some((p) => p.id === params.id)) return error(PLANT_NOT_FOUND, 404);
        store.write(userId, {
          ...garden,
          ownPlants: garden.ownPlants.map((p) =>
            p.id === params.id ? { ...p, archived: true } : p,
          ),
        });
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.post(
      '/api/catalog/plants/:id/publication',
      withUser(({ params, userId }) => {
        const garden = store.read(userId);
        const existing = garden.ownPlants?.find((p) => p.id === params.id && !p.archived);
        if (!existing) return error(PLANT_NOT_FOUND, 404);
        const status = existing.publication?.status;
        if (status === 'PUBLISHED') return error('Diese Sorte ist bereits veröffentlicht.', 409);
        if (status === 'PENDING') return HttpResponse.json<CatalogPlant>(listed(existing));
        const issues = neighborIssues(
          existing,
          existing.id,
          GLOBAL_IDS,
          'Globale Sorten dürfen nur auf globale Sorten verweisen.',
        );
        if (issues.length > 0) return error('Bitte prüfe die Nachbarn.', 400, issues);
        const plant: OwnMockPlant = { ...existing, publication: { status: 'PENDING' } };
        store.write(userId, {
          ...garden,
          ownPlants: (garden.ownPlants ?? []).map((p) => (p.id === plant.id ? plant : p)),
        });
        return HttpResponse.json<CatalogPlant>(listed(plant));
      }),
    ),

    http.put(
      '/api/catalog/plants/:id/override',
      withUser(async ({ request, params, userId }) => {
        const plant = seedPlants.find((p) => p.id === params.id);
        if (!plant) return error(PLANT_NOT_FOUND, 404);
        const parsed = await parse(request, SaveOverrideRequestSchema);
        if (parsed.response) return parsed.response;
        const garden = store.read(userId);
        store.write(userId, {
          ...garden,
          overrides: { ...garden.overrides, [plant.id]: parsed.data },
        });
        return HttpResponse.json<CatalogPlant>(effective(plant, parsed.data));
      }),
    ),

    http.delete(
      '/api/catalog/plants/:id/override',
      withUser(({ params, userId }) => {
        const plant = seedPlants.find((p) => p.id === params.id);
        if (!plant) return error(PLANT_NOT_FOUND, 404);
        const garden = store.read(userId);
        const { [plant.id]: _removed, ...overrides } = garden.overrides ?? {};
        store.write(userId, { ...garden, overrides });
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.get(
      '/api/garden/beds',
      withUser(({ userId }) =>
        HttpResponse.json<ListBedsResponse>({ beds: [...store.read(userId).beds].sort(byName) }),
      ),
    ),

    http.post(
      '/api/garden/beds',
      withUser(async ({ request, userId }) => {
        const parsed = await parse(request, SaveBedRequestSchema);
        if (parsed.response) return parsed.response;
        const bed: Bed = { ...parsed.data, id: newId() };
        const garden = store.read(userId);
        store.write(userId, { ...garden, beds: [...garden.beds, bed] });
        return HttpResponse.json(bed, { status: 201 });
      }),
    ),

    http.get(
      '/api/garden/beds/:bedId',
      withUser(({ params, userId }) => {
        const garden = store.read(userId);
        const bed = garden.beds.find((b) => b.id === params.bedId);
        if (!bed) return error(BED_NOT_FOUND, 404);
        return HttpResponse.json<BedWithPlantingsResponse>({
          bed,
          plantings: garden.plantings.filter((p) => p.bedId === bed.id),
        });
      }),
    ),

    http.put(
      '/api/garden/beds/:bedId',
      withUser(async ({ request, params, userId }) => {
        const parsed = await parse(request, SaveBedRequestSchema);
        if (parsed.response) return parsed.response;
        const garden = store.read(userId);
        if (!garden.beds.some((b) => b.id === params.bedId)) return error(BED_NOT_FOUND, 404);
        const bed: Bed = { ...parsed.data, id: params.bedId ?? '' };
        store.write(userId, {
          ...garden,
          beds: garden.beds.map((b) => (b.id === bed.id ? bed : b)),
        });
        return HttpResponse.json(bed);
      }),
    ),

    http.delete(
      '/api/garden/beds/:bedId',
      withUser(({ params, userId }) => {
        const garden = store.read(userId);
        if (!garden.beds.some((b) => b.id === params.bedId)) return error(BED_NOT_FOUND, 404);
        store.write(userId, {
          ...garden,
          beds: garden.beds.filter((b) => b.id !== params.bedId),
          plantings: garden.plantings.filter((p) => p.bedId !== params.bedId),
        });
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.post(
      '/api/garden/beds/:bedId/plantings',
      withUser(async ({ request, params, userId }) => {
        const parsed = await parse(request, SavePlantingRequestSchema);
        if (parsed.response) return parsed.response;
        const garden = store.read(userId);
        if (!garden.beds.some((b) => b.id === params.bedId)) return error(BED_NOT_FOUND, 404);
        const planting: Planting = { ...parsed.data, id: newId(), bedId: params.bedId ?? '' };
        store.write(userId, { ...garden, plantings: [...garden.plantings, planting] });
        return HttpResponse.json(planting, { status: 201 });
      }),
    ),

    http.put(
      '/api/garden/beds/:bedId/plantings/:id',
      withUser(async ({ request, params, userId }) => {
        const parsed = await parse(request, SavePlantingRequestSchema);
        if (parsed.response) return parsed.response;
        const garden = store.read(userId);
        const exists = garden.plantings.some((p) => p.id === params.id && p.bedId === params.bedId);
        if (!exists) return error(PLANTING_NOT_FOUND, 404);
        const planting: Planting = {
          ...parsed.data,
          id: params.id ?? '',
          bedId: params.bedId ?? '',
        };
        store.write(userId, {
          ...garden,
          plantings: garden.plantings.map((p) => (p.id === planting.id ? planting : p)),
        });
        return HttpResponse.json(planting);
      }),
    ),

    http.delete(
      '/api/garden/beds/:bedId/plantings/:id',
      withUser(({ params, userId }) => {
        const garden = store.read(userId);
        const exists = garden.plantings.some((p) => p.id === params.id && p.bedId === params.bedId);
        if (!exists) return error(PLANTING_NOT_FOUND, 404);
        store.write(userId, {
          ...garden,
          plantings: garden.plantings.filter((p) => p.id !== params.id),
        });
        return new HttpResponse(null, { status: 204 });
      }),
    ),
  ];
}

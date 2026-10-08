import { seedPlants } from '@hochbeet/catalog-seed';
import {
  type Bed,
  type BedWithPlantingsResponse,
  type CatalogPlant,
  type ErrorResponse,
  type ListBedsResponse,
  type ListPlantsResponse,
  type Planting,
  SaveBedRequestSchema,
  SavePlantingRequestSchema,
} from '@hochbeet/contracts';
import { http, HttpResponse } from 'msw';
import { ulid } from 'ulid';
import type { z } from 'zod';
import type { MockStore } from './store';

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
      withUser(() =>
        HttpResponse.json<ListPlantsResponse>({
          plants: seedPlants.map((plant): CatalogPlant => ({
            ...plant,
            source: 'GLOBAL',
            overridden: false,
          })),
        }),
      ),
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
  ];
}

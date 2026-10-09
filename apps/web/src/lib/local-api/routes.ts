import {
  type Bed,
  type BedWithPlantingsResponse,
  type CatalogPlant,
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
import { ulid } from 'ulid';
import { error, json, noContent, parseJson, route, type Route } from './router';
import type { GardenRepository, LocalGarden, OwnPlant } from './store';

export interface LocalApiOptions {
  repo: GardenRepository;
  /** The global catalogue the user's adjustments and own plants build on. */
  globals: () => readonly Plant[] | Promise<readonly Plant[]>;
  newId?: () => string;
}

const byName = (a: Bed, b: Bed) => a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id);
const BED_NOT_FOUND = 'Dieses Beet gibt es nicht.';
const PLANTING_NOT_FOUND = 'Diese Pflanzung gibt es nicht.';
export const PLANT_NOT_FOUND = 'Diese Sorte gibt es nicht.';
export const GLOBAL_NEIGHBORS_ONLY = 'Globale Sorten dürfen nur auf globale Sorten verweisen.';

/** A global plant as the user sees it, like the catalog service's effective catalogue. */
export function effective(plant: Plant, override: PlantOverride | undefined): CatalogPlant {
  if (!override) return { ...plant, source: 'GLOBAL', overridden: false };
  const { id: _id, ...global } = plant;
  return { ...plant, ...override, id: plant.id, source: 'GLOBAL', overridden: true, global };
}

/** Like the catalog service: neighbours must be known plants and never the plant itself. */
export function neighborIssues(
  fields: PlantFields,
  selfId: string,
  known: Set<string>,
  unknown: string,
) {
  return (['goodNeighbors', 'badNeighbors'] as const).flatMap((list) =>
    fields[list].flatMap((neighborId, index) => {
      const path = `${list}.${String(index)}`;
      if (neighborId === selfId)
        return [{ path, message: 'Eine Sorte kann nicht ihr eigener Nachbar sein.' }];
      return known.has(neighborId) ? [] : [{ path, message: unknown }];
    }),
  );
}

export const idsOf = (plants: readonly Plant[]) => new Set(plants.map((p) => p.id));
const ownKnown = (globals: readonly Plant[], garden: LocalGarden) =>
  new Set([
    ...idsOf(globals),
    ...(garden.ownPlants ?? []).filter((p) => !p.archived).map((p) => p.id),
  ]);

/** An own plant as the catalogue lists it, without the archive flag. */
export const listed = ({ archived: _archived, ...plant }: OwnPlant): CatalogPlant => plant;

/**
 * The garden service and the user's part of the catalog service, answered from one user's
 * data: same routes, contract schemas and error format as the services. Used for guests and,
 * per test user, by the mock API of the dev server.
 */
export function localRoutes({ repo, globals, newId = () => ulid() }: LocalApiOptions): Route[] {
  const saveOwn = (garden: LocalGarden, plant: OwnPlant) => {
    repo.write({
      ...garden,
      ownPlants: (garden.ownPlants ?? []).map((p) => (p.id === plant.id ? plant : p)),
    });
  };

  return [
    route('GET', '/api/catalog/plants', async () => {
      const garden = repo.read();
      const overrides = garden.overrides ?? {};
      const own = (garden.ownPlants ?? [])
        .filter((p) => !p.archived && p.publication?.status !== 'PUBLISHED')
        .map(listed);
      return json<ListPlantsResponse>({
        plants: [
          ...(await globals()).map((plant) => effective(plant, overrides[plant.id])),
          ...own,
        ].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      });
    }),

    route('POST', '/api/catalog/plants', async ({ request }) => {
      const parsed = await parseJson(request, SavePlantRequestSchema);
      if (parsed.response) return parsed.response;
      const garden = repo.read();
      const id = newId();
      const issues = neighborIssues(
        parsed.data,
        id,
        ownKnown(await globals(), garden),
        'Unbekannte Sorte.',
      );
      if (issues.length > 0) return error('Bitte prüfe die Nachbarn.', 400, issues);
      const plant: CatalogPlant = {
        ...parsed.data,
        id,
        source: 'OWN',
        overridden: false,
        publication: { status: 'PRIVATE' },
      };
      repo.write({ ...garden, ownPlants: [...(garden.ownPlants ?? []), plant] });
      return json(plant, 201);
    }),

    route('PUT', '/api/catalog/plants/:id', async ({ request, params }) => {
      const parsed = await parseJson(request, SavePlantRequestSchema);
      if (parsed.response) return parsed.response;
      const garden = repo.read();
      const existing = garden.ownPlants?.find((p) => p.id === params.id && !p.archived);
      if (!existing) return error(PLANT_NOT_FOUND, 404);
      const issues = neighborIssues(
        parsed.data,
        existing.id,
        ownKnown(await globals(), garden),
        'Unbekannte Sorte.',
      );
      if (issues.length > 0) return error('Bitte prüfe die Nachbarn.', 400, issues);
      // Publication state is not part of the fields; it changes only through the workflow.
      const plant: OwnPlant = { ...existing, ...parsed.data, id: existing.id };
      saveOwn(garden, plant);
      return json<CatalogPlant>(listed(plant));
    }),

    route('DELETE', '/api/catalog/plants/:id', ({ params }) => {
      const garden = repo.read();
      const existing = garden.ownPlants?.find((p) => p.id === params.id);
      if (!existing) return error(PLANT_NOT_FOUND, 404);
      saveOwn(garden, { ...existing, archived: true });
      return noContent();
    }),

    route('PUT', '/api/catalog/plants/:id/override', async ({ request, params }) => {
      const plant = (await globals()).find((p) => p.id === params.id);
      if (!plant) return error(PLANT_NOT_FOUND, 404);
      const parsed = await parseJson(request, SaveOverrideRequestSchema);
      if (parsed.response) return parsed.response;
      const garden = repo.read();
      repo.write({ ...garden, overrides: { ...garden.overrides, [plant.id]: parsed.data } });
      return json<CatalogPlant>(effective(plant, parsed.data));
    }),

    route('DELETE', '/api/catalog/plants/:id/override', async ({ params }) => {
      const plant = (await globals()).find((p) => p.id === params.id);
      if (!plant) return error(PLANT_NOT_FOUND, 404);
      const garden = repo.read();
      const { [plant.id]: _removed, ...overrides } = garden.overrides ?? {};
      repo.write({ ...garden, overrides });
      return noContent();
    }),

    route('GET', '/api/garden/beds', () =>
      json<ListBedsResponse>({ beds: [...repo.read().beds].sort(byName) }),
    ),

    route('POST', '/api/garden/beds', async ({ request }) => {
      const parsed = await parseJson(request, SaveBedRequestSchema);
      if (parsed.response) return parsed.response;
      const bed: Bed = { ...parsed.data, id: newId() };
      const garden = repo.read();
      repo.write({ ...garden, beds: [...garden.beds, bed] });
      return json(bed, 201);
    }),

    route('GET', '/api/garden/beds/:bedId', ({ params }) => {
      const garden = repo.read();
      const bed = garden.beds.find((b) => b.id === params.bedId);
      if (!bed) return error(BED_NOT_FOUND, 404);
      return json<BedWithPlantingsResponse>({
        bed,
        plantings: garden.plantings.filter((p) => p.bedId === bed.id),
      });
    }),

    route('PUT', '/api/garden/beds/:bedId', async ({ request, params }) => {
      const parsed = await parseJson(request, SaveBedRequestSchema);
      if (parsed.response) return parsed.response;
      const garden = repo.read();
      if (!garden.beds.some((b) => b.id === params.bedId)) return error(BED_NOT_FOUND, 404);
      const bed: Bed = { ...parsed.data, id: params.bedId ?? '' };
      repo.write({ ...garden, beds: garden.beds.map((b) => (b.id === bed.id ? bed : b)) });
      return json(bed);
    }),

    route('DELETE', '/api/garden/beds/:bedId', ({ params }) => {
      const garden = repo.read();
      if (!garden.beds.some((b) => b.id === params.bedId)) return error(BED_NOT_FOUND, 404);
      repo.write({
        ...garden,
        beds: garden.beds.filter((b) => b.id !== params.bedId),
        plantings: garden.plantings.filter((p) => p.bedId !== params.bedId),
      });
      return noContent();
    }),

    route('POST', '/api/garden/beds/:bedId/plantings', async ({ request, params }) => {
      const parsed = await parseJson(request, SavePlantingRequestSchema);
      if (parsed.response) return parsed.response;
      const garden = repo.read();
      if (!garden.beds.some((b) => b.id === params.bedId)) return error(BED_NOT_FOUND, 404);
      const planting: Planting = { ...parsed.data, id: newId(), bedId: params.bedId ?? '' };
      repo.write({ ...garden, plantings: [...garden.plantings, planting] });
      return json(planting, 201);
    }),

    route('PUT', '/api/garden/beds/:bedId/plantings/:id', async ({ request, params }) => {
      const parsed = await parseJson(request, SavePlantingRequestSchema);
      if (parsed.response) return parsed.response;
      const garden = repo.read();
      const exists = garden.plantings.some((p) => p.id === params.id && p.bedId === params.bedId);
      if (!exists) return error(PLANTING_NOT_FOUND, 404);
      const planting: Planting = { ...parsed.data, id: params.id ?? '', bedId: params.bedId ?? '' };
      repo.write({
        ...garden,
        plantings: garden.plantings.map((p) => (p.id === planting.id ? planting : p)),
      });
      return json(planting);
    }),

    route('DELETE', '/api/garden/beds/:bedId/plantings/:id', ({ params }) => {
      const garden = repo.read();
      const exists = garden.plantings.some((p) => p.id === params.id && p.bedId === params.bedId);
      if (!exists) return error(PLANTING_NOT_FOUND, 404);
      repo.write({ ...garden, plantings: garden.plantings.filter((p) => p.id !== params.id) });
      return noContent();
    }),
  ];
}

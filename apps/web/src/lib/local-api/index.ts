import { ListPublicPlantsResponseSchema, type Plant } from '@hochbeet/contracts';
import { localRoutes, type LocalApiOptions } from './routes';
import { error, handle, LocalApiError, route, toRequest } from './router';
import { createGuestRepository } from './store';

const CATALOG_UNAVAILABLE =
  'Der Katalog ist gerade nicht erreichbar. Prüfe deine Internetverbindung und versuche es noch einmal.';

/**
 * The global catalogue from the public route, loaded once per session and shared by all local
 * requests. A failed load is not kept, so the next request tries again.
 */
export function publicCatalog(baseFetch: typeof fetch): () => Promise<readonly Plant[]> {
  let loading: Promise<readonly Plant[]> | undefined;
  const load = async () => {
    const response = await baseFetch('/api/catalog/public/plants').catch(() => undefined);
    if (!response?.ok) throw new LocalApiError(503, CATALOG_UNAVAILABLE);
    const parsed = ListPublicPlantsResponseSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!parsed.success) throw new LocalApiError(503, CATALOG_UNAVAILABLE);
    return parsed.data.plants;
  };
  return () => {
    loading ??= load().catch((cause: unknown) => {
      loading = undefined;
      throw cause;
    });
    return loading;
  };
}

export { localRoutes, type LocalApiOptions } from './routes';
export { LocalApiError } from './router';
export { createGuestRepository, type GardenRepository, type LocalGarden } from './store';

/**
 * `fetch` for guests: the garden service and the user's part of the catalog service run in
 * the browser on the guest's localStorage. Other requests outside /api use the real fetch.
 */
export function createLocalFetch({
  repo = createGuestRepository(),
  ...options
}: Omit<LocalApiOptions, 'repo'> & { repo?: LocalApiOptions['repo'] }): typeof fetch {
  const routes = [
    ...localRoutes({ repo, ...options }),
    route('POST', '/api/catalog/plants/:id/publication', () =>
      error('Melde dich an, um eine Sorte für alle vorzuschlagen.', 403),
    ),
  ];
  return async (input, init) => {
    const request = toRequest(input, init);
    if (!new URL(request.url).pathname.startsWith('/api/')) return fetch(input, init);
    return handle(routes, request);
  };
}

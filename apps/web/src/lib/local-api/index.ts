import { localRoutes, type LocalApiOptions } from './routes';
import { error, handle, route, toRequest } from './router';
import { createGuestRepository } from './store';

export { localRoutes, type LocalApiOptions } from './routes';
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

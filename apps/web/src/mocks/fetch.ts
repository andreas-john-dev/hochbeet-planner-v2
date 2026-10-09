import { localRoutes } from '@/lib/local-api/routes';
import { error, handle, toRequest } from '@/lib/local-api/router';
import { mockRoutes, userOf } from './handlers';
import { MockStore } from './store';

/**
 * `fetch` for the mock API mode: requests under /api are answered in the browser, per test
 * user from the mock ID token, by the local API plus the mock-only publication and admin
 * routes; everything else uses the real fetch. Loaded on demand only.
 */
export function createMockFetch(store = new MockStore()): typeof fetch {
  return async (input, init) => {
    const request = toRequest(input, init);
    if (!new URL(request.url).pathname.startsWith('/api/')) return fetch(input, init);
    const user = userOf(request);
    if (!user) return error('Bitte melde dich an.', 401);
    const routes = [
      ...localRoutes({ repo: store.repository(user.id), globals: () => store.readCatalog() }),
      ...mockRoutes(store, user),
    ];
    return handle(routes, request);
  };
}

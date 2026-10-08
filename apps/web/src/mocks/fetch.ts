import { getResponse } from 'msw';
import { createHandlers } from './handlers';
import { MockStore } from './store';

/**
 * `fetch` for the mock API mode: requests under /api go through the MSW handlers in memory,
 * without a service worker; everything else uses the real fetch. Loaded on demand only.
 */
export function createMockFetch(store = new MockStore()): typeof fetch {
  const handlers = createHandlers(store);
  return async (input, init) => {
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    const request = new Request(new URL(url, window.location.origin), init);
    if (!new URL(request.url).pathname.startsWith('/api/')) return fetch(input, init);
    return (
      (await getResponse(handlers, request)) ??
      Response.json({ message: 'Diese Adresse gibt es nicht.' }, { status: 404 })
    );
  };
}

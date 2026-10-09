import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { createApiClient, shouldRetry } from '@/lib/api';
import { ApiContext } from '@/lib/api-context';
import { useAuth } from '@/lib/auth/context';

/**
 * Provides `useApi()` and the query cache. Signed-in users talk to the services (`fetchFn` is
 * the mock fetch in mock API mode); guests get the local API on their browser storage, with the
 * global catalogue from the public route. Each identity gets a fresh query cache, so nobody
 * sees cached data of the previous one.
 */
export function ApiProvider({
  fetchFn,
  children,
}: {
  fetchFn?: typeof fetch | undefined;
  children: ReactNode;
}) {
  const { adapter, user, guest } = useAuth();
  const [localFetch] = useState(() => lazyLocalFetch(fetchFn));
  const api = useMemo(
    () =>
      guest
        ? createApiClient(() => Promise.resolve(null), localFetch)
        : createApiClient(() => adapter.getIdToken(), fetchFn),
    [guest, localFetch, adapter, fetchFn],
  );
  const identity = guest ? 'guest' : (user?.userId ?? 'signed-out');
  const queryClient = useMemo(() => newQueryClient(identity), [identity]);

  return (
    <ApiContext value={api}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiContext>
  );
}

/** A fresh query cache; `identity` only marks whose it is. */
const newQueryClient = (_identity: string) =>
  new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } });

/**
 * The guests' `fetch`: loads the local API on first use, so signed-in users never download it.
 * `fetchFn` (or the real fetch) serves the public catalogue.
 */
function lazyLocalFetch(fetchFn: typeof fetch | undefined): typeof fetch {
  let local: Promise<typeof fetch> | undefined;
  return async (input, init) => {
    local ??= import('@/lib/local-api').then(({ createLocalFetch, publicCatalog }) => {
      const baseFetch = fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
      return createLocalFetch({ globals: publicCatalog(baseFetch) });
    });
    return (await local)(input, init);
  };
}

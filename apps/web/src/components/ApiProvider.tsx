import { useMemo, type ReactNode } from 'react';
import { createApiClient } from '@/lib/api';
import { ApiContext } from '@/lib/api-context';
import { useAuth } from '@/lib/auth/context';

/** Provides `useApi()`; `fetchFn` is the mock fetch in mock API mode. */
export function ApiProvider({
  fetchFn,
  children,
}: {
  fetchFn?: typeof fetch | undefined;
  children: ReactNode;
}) {
  const { adapter } = useAuth();
  const api = useMemo(
    () => createApiClient(() => adapter.getIdToken(), fetchFn),
    [adapter, fetchFn],
  );
  return <ApiContext value={api}>{children}</ApiContext>;
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, AuthStore } from '@/lib/auth/context';
import type { AuthAdapter, AuthUser } from '@/lib/auth/types';

/** Holds the signed-in user. Renders nothing until the session has been checked once. */
export function AuthProvider({ adapter, children }: { adapter: AuthAdapter; children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  // The router reads this store in beforeLoad, so it sees a sign-in before React re-renders.
  const [store] = useState(() => new AuthStore());

  const update = useCallback(
    (next: AuthUser | null) => {
      store.set(next);
      setUser(next);
    },
    [store],
  );

  useEffect(() => {
    let active = true;
    void adapter.getCurrentUser().then((current) => {
      if (!active) return;
      update(current);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [adapter, update]);

  const value = useMemo(
    () => ({
      store,
      user,
      adapter,
      refresh: async () => {
        const current = await adapter.getCurrentUser();
        update(current);
        return current;
      },
      signOut: async () => {
        await adapter.signOut();
        update(null);
      },
    }),
    [store, user, adapter, update],
  );

  if (!ready) return null;
  return <AuthContext value={value}>{children}</AuthContext>;
}

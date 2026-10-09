import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, AuthStore } from '@/lib/auth/context';
import { deleteGuestData, readGuestMode, writeGuestMode } from '@/lib/auth/guest';
import type { AuthAdapter, AuthUser } from '@/lib/auth/types';

/**
 * Holds the signed-in user or guest mode. Renders nothing until the session has been checked
 * once. Signing in ends guest mode; the guest's data stays in the browser.
 */
export function AuthProvider({ adapter, children }: { adapter: AuthAdapter; children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [guest, setGuest] = useState(false);
  const [ready, setReady] = useState(false);
  // The router reads this store in beforeLoad, so it sees a sign-in before React re-renders.
  const [store] = useState(() => new AuthStore());

  const update = useCallback(
    (nextUser: AuthUser | null, nextGuest: boolean) => {
      const isGuest = !nextUser && nextGuest;
      writeGuestMode(isGuest);
      store.set(nextUser, isGuest);
      setUser(nextUser);
      setGuest(isGuest);
    },
    [store],
  );

  useEffect(() => {
    let active = true;
    void adapter.getCurrentUser().then((current) => {
      if (!active) return;
      update(current, readGuestMode());
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
      guest,
      adapter,
      refresh: async () => {
        const current = await adapter.getCurrentUser();
        update(current, store.guest);
        return current;
      },
      signOut: async () => {
        await adapter.signOut();
        update(null, false);
      },
      startGuest: () => {
        update(null, true);
      },
      endGuest: ({ deleteData }: { deleteData: boolean }) => {
        if (deleteData) deleteGuestData();
        update(null, false);
      },
    }),
    [store, user, guest, adapter, update],
  );

  if (!ready) return null;
  return <AuthContext value={value}>{children}</AuthContext>;
}

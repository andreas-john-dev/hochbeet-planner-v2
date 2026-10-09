import { RouterProvider, type RouterHistory } from '@tanstack/react-router';
import { useState } from 'react';
import { ApiProvider } from '@/components/ApiProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useAuth } from '@/lib/auth/context';
import type { AuthAdapter } from '@/lib/auth/types';
import { createAppRouter } from '@/router';

function AppRouter({ history }: { history?: RouterHistory | undefined }) {
  const { store } = useAuth();
  const [router] = useState(() => createAppRouter(store, history));
  return <RouterProvider router={router} />;
}

export function App({
  auth,
  history,
  fetchFn,
}: {
  auth: AuthAdapter;
  history?: RouterHistory;
  /** Replaces fetch for API calls, e.g. the mock API in dev and tests. */
  fetchFn?: typeof fetch;
}) {
  return (
    <ThemeProvider>
      <AuthProvider adapter={auth}>
        <ApiProvider fetchFn={fetchFn}>
          <AppRouter history={history} />
        </ApiProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

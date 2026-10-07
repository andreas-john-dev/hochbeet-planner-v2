import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, type RouterHistory } from '@tanstack/react-router';
import { useState } from 'react';
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

export function App({ auth, history }: { auth: AuthAdapter; history?: RouterHistory }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <AuthProvider adapter={auth}>
        <QueryClientProvider client={queryClient}>
          <AppRouter history={history} />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

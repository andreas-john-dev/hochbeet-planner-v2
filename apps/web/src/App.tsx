import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, type RouterHistory } from '@tanstack/react-router';
import { useState } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { createAppRouter } from '@/router';

export function App({ history }: { history?: RouterHistory }) {
  const [queryClient] = useState(() => new QueryClient());
  const [router] = useState(() => createAppRouter(history));

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

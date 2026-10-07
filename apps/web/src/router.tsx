import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import { AdminPage } from '@/routes/AdminPage';
import { BedsPage } from '@/routes/BedsPage';
import { CatalogPage } from '@/routes/CatalogPage';
import { NotFoundPage } from '@/routes/NotFoundPage';
import { ProfilePage } from '@/routes/ProfilePage';

const rootRoute = createRootRoute({ component: AppShell, notFoundComponent: NotFoundPage });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects by throwing
    throw redirect({ to: '/beete' });
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  createRoute({ getParentRoute: () => rootRoute, path: '/beete', component: BedsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/katalog', component: CatalogPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/profil', component: ProfilePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminPage }),
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history, defaultPreload: 'intent', scrollRestoration: true });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

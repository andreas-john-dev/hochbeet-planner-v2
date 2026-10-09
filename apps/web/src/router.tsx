import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import type { AuthStore } from '@/lib/auth/context';
import { AdminLayout } from '@/routes/admin/AdminLayout';
import { AdminPage } from '@/routes/admin/AdminPage';
import { GlobalPlantFormPage } from '@/routes/admin/GlobalPlantFormPage';
import { PublicationReviewPage } from '@/routes/admin/PublicationReviewPage';
import { AuthLayout } from '@/routes/auth/AuthLayout';
import { ForgotPasswordPage } from '@/routes/auth/ForgotPasswordPage';
import { parseSignInSearch, parseSignUpSearch } from '@/routes/auth/search';
import { SignInPage } from '@/routes/auth/SignInPage';
import { SignUpPage } from '@/routes/auth/SignUpPage';
import { BedEditorPage } from '@/routes/BedEditorPage';
import { BedsPage } from '@/routes/BedsPage';
import { CatalogPage } from '@/routes/CatalogPage';
import { IconGalleryPage } from '@/routes/dev/IconGalleryPage';
import { NotFoundPage } from '@/routes/NotFoundPage';
import { PlantDetailPage } from '@/routes/PlantDetailPage';
import { PlantFormPage } from '@/routes/PlantFormPage';
import { ProfilePage } from '@/routes/ProfilePage';

export interface RouterContext {
  auth: AuthStore;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
});

/* eslint-disable @typescript-eslint/only-throw-error -- TanStack Router redirects by throwing */

// Sign-in, sign-up and password reset: only for signed-out users.
const authLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  component: AuthLayout,
  beforeLoad: ({ context }) => {
    if (context.auth.user) throw redirect({ to: '/beete' });
  },
});

const signInRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/anmelden',
  component: SignInPage,
  validateSearch: parseSignInSearch,
});

const signUpRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/registrieren',
  component: SignUpPage,
  validateSearch: parseSignUpSearch,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/passwort-vergessen',
  component: ForgotPasswordPage,
});

// Everything else needs a signed-in user.
const appLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AppShell,
  beforeLoad: ({ context, location }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/anmelden', search: { redirect: location.href } });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/beete' });
  },
});

/* eslint-enable @typescript-eslint/only-throw-error */

// Admin area: AdminLayout shows a 403 page to everyone else (no redirect, see T-33).
const adminRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/admin',
  component: AdminLayout,
});

const adminChildren = [
  createRoute({ getParentRoute: () => adminRoute, path: '/', component: AdminPage }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: '/anfragen/$plantId',
    component: PublicationReviewPage,
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: '/sorten/neu',
    component: GlobalPlantFormPage,
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: '/sorten/$plantId',
    component: GlobalPlantFormPage,
  }),
];

const bedEditorRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/beete/$bedId',
  component: BedEditorPage,
});

// Developer pages: public, no data.
const iconGalleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/icons',
  component: IconGalleryPage,
});

const routeTree = rootRoute.addChildren([
  authLayout.addChildren([signInRoute, signUpRoute, forgotPasswordRoute]),
  appLayout.addChildren([
    indexRoute,
    createRoute({ getParentRoute: () => appLayout, path: '/beete', component: BedsPage }),
    bedEditorRoute,
    createRoute({ getParentRoute: () => appLayout, path: '/katalog', component: CatalogPage }),
    createRoute({
      getParentRoute: () => appLayout,
      path: '/katalog/neu',
      component: PlantFormPage,
    }),
    createRoute({
      getParentRoute: () => appLayout,
      path: '/katalog/$plantId',
      component: PlantDetailPage,
    }),
    createRoute({
      getParentRoute: () => appLayout,
      path: '/katalog/$plantId/bearbeiten',
      component: PlantFormPage,
    }),
    createRoute({ getParentRoute: () => appLayout, path: '/profil', component: ProfilePage }),
    adminRoute.addChildren(adminChildren),
  ]),
  iconGalleryRoute,
]);

export function createAppRouter(auth: AuthStore, history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: { auth },
    defaultPreload: 'intent',
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

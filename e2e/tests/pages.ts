import { EXAMPLE_BED_ID, exampleGarden, type Garden, PENDING_ID, pendingRequest } from './garden';

/**
 * Who opens a page: anyone signed out, any signed-in user, admins only, or a guest without
 * account (data in the browser, see apps/web/src/lib/local-api).
 */
export type Access = 'public' | 'user' | 'admin' | 'guest';

/** All top-level pages. Add new pages here so tests and PR screenshots cover them. */
export interface AppPage {
  /** Stable id, used as screenshot file name. */
  id: string;
  path: string;
  /** Visible h1, used to wait until the page has rendered. */
  heading: string;
  access: Access;
  /** Label in the main navigation, for pages that have one. */
  navLabel?: string;
  /** Data of the signed-in user or guest, for pages that only show something with data. */
  seed?: Garden;
}

export const appPages: readonly AppPage[] = [
  { id: 'anmelden', path: '/anmelden', heading: 'Anmelden', access: 'public' },
  { id: 'registrieren', path: '/registrieren', heading: 'Registrieren', access: 'public' },
  {
    id: 'passwort-vergessen',
    path: '/passwort-vergessen',
    heading: 'Passwort vergessen',
    access: 'public',
  },
  {
    id: 'beete',
    path: '/beete',
    heading: 'Meine Beete',
    access: 'user',
    navLabel: 'Beete',
    seed: exampleGarden,
  },
  {
    id: 'beet-editor',
    path: `/beete/${EXAMPLE_BED_ID}`,
    heading: 'Hochbeet Süd',
    access: 'user',
    seed: exampleGarden,
  },
  {
    id: 'katalog',
    path: '/katalog',
    heading: 'Pflanzenkatalog',
    access: 'user',
    navLabel: 'Katalog',
  },
  {
    id: 'katalog-neu',
    path: '/katalog/neu',
    heading: 'Eigene Sorte anlegen',
    access: 'user',
  },
  {
    id: 'katalog-sorte',
    path: '/katalog/01M49THV00RK9E9PC83NEE87CJ',
    heading: 'Kopfsalat',
    access: 'user',
  },
  { id: 'profil', path: '/profil', heading: 'Profil', access: 'user', navLabel: 'Profil' },
  {
    id: 'admin',
    path: '/admin',
    heading: 'Administration',
    access: 'admin',
    navLabel: 'Admin',
  },
  {
    id: 'admin-anfrage',
    path: `/admin/anfragen/${PENDING_ID}`,
    heading: 'Anfrage prüfen',
    access: 'admin',
    // The admin's own request: the queue lists requests of all users.
    seed: { beds: [], plantings: [], ownPlants: [pendingRequest] },
  },
  {
    id: 'admin-sorte-neu',
    path: '/admin/sorten/neu',
    heading: 'Globale Sorte anlegen',
    access: 'admin',
  },
  {
    id: 'admin-sorte',
    path: '/admin/sorten/01M49THV00RK9E9PC83NEE87CJ',
    heading: 'Globale Sorte bearbeiten',
    access: 'admin',
  },
  { id: 'dev-icons', path: '/dev/icons', heading: 'Icon-Galerie', access: 'public' },
  // Guest mode: same pages, with the guest banner and the local API.
  {
    id: 'gast-beete',
    path: '/beete',
    heading: 'Meine Beete',
    access: 'guest',
    seed: exampleGarden,
  },
  {
    id: 'gast-beet-editor',
    path: `/beete/${EXAMPLE_BED_ID}`,
    heading: 'Hochbeet Süd',
    access: 'guest',
    seed: exampleGarden,
  },
  { id: 'gast-katalog', path: '/katalog', heading: 'Pflanzenkatalog', access: 'guest' },
];

/** Pages that need an account; signed out they redirect to the sign-in page. */
export const protectedPages = appPages.filter((p) => p.access === 'user' || p.access === 'admin');

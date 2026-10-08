/** Who may open a page: anyone signed out, any signed-in user, or admins only. */
export type Access = 'public' | 'user' | 'admin';

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
  { id: 'beete', path: '/beete', heading: 'Meine Beete', access: 'user', navLabel: 'Beete' },
  {
    id: 'katalog',
    path: '/katalog',
    heading: 'Pflanzenkatalog',
    access: 'user',
    navLabel: 'Katalog',
  },
  { id: 'profil', path: '/profil', heading: 'Profil', access: 'user', navLabel: 'Profil' },
  {
    id: 'admin',
    path: '/admin',
    heading: 'Administration',
    access: 'admin',
    navLabel: 'Admin',
  },
  { id: 'dev-icons', path: '/dev/icons', heading: 'Icon-Galerie', access: 'public' },
];

export const protectedPages = appPages.filter((p) => p.access !== 'public');

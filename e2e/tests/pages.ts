/** All top-level pages. Add new pages here so tests and PR screenshots cover them. */
export interface AppPage {
  /** Stable id, used as screenshot file name. */
  id: string;
  path: string;
  /** Visible h1, used to wait until the page has rendered. */
  heading: string;
  /** Label in the main navigation. */
  navLabel: string;
}

export const appPages: readonly AppPage[] = [
  { id: 'beete', path: '/beete', heading: 'Meine Beete', navLabel: 'Beete' },
  { id: 'katalog', path: '/katalog', heading: 'Pflanzenkatalog', navLabel: 'Katalog' },
  { id: 'profil', path: '/profil', heading: 'Profil', navLabel: 'Profil' },
  { id: 'admin', path: '/admin', heading: 'Administration', navLabel: 'Admin' },
];

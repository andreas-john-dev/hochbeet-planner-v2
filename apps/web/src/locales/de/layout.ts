/** App frame: navigation, colour scheme, guest banner, 404 and 403 pages. */
export const layout = {
  nav: {
    label: 'Hauptnavigation',
    beds: 'Beete',
    sowings: 'Anzucht',
    catalog: 'Katalog',
    profile: 'Profil',
    admin: 'Admin',
  },
  guestMode: 'Gastmodus',
  signOut: 'Abmelden',
  theme: {
    name: 'Farbschema',
    light: 'Hell',
    dark: 'Dunkel',
    system: 'System',
    current: 'Farbschema: {{theme}}',
    switch: 'Farbschema: {{theme}}. Wechseln zu {{next}}',
  },
  guestBanner: {
    lead: 'Du planst ohne Konto.',
    text: 'Deine Beete liegen nur in diesem Browser. Mit einem Konto sind sie gesichert und auf allen Geräten da.',
    createAccount: 'Konto anlegen',
    signIn: 'Anmelden',
    end: 'Gastmodus beenden',
    endTitle: 'Gastmodus beenden?',
    endDescription:
      'Deine Beete, Pflanzungen und eigenen Sorten liegen nur in diesem Browser. Behalte sie für später oder lösche sie jetzt. Löschen lässt sich nicht rückgängig machen.',
    keepData: 'Daten behalten',
    deleteData: 'Daten löschen',
  },
  toBeds: 'Zu den Beeten',
  notFound: {
    title: 'Seite nicht gefunden',
    text: 'Diese Adresse gibt es nicht. Vielleicht hat sich ein Tippfehler eingeschlichen.',
  },
  forbidden: {
    title: 'Kein Zugriff',
    text: 'Dieser Bereich ist nur für Admins. Fehler 403: Dir fehlt die Berechtigung für diese Seite.',
  },
};

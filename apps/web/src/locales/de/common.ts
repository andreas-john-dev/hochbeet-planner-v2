/** Texts shared by many areas: app name, standard buttons, loading and API errors. */
export const common = {
  appName: 'Hochbeet-Planer',
  cancel: 'Abbrechen',
  close: 'Schließen',
  save: 'Speichern',
  delete: 'Löschen',
  back: 'Zurück',
  loading: 'Wird geladen …',
  language: {
    label: 'Sprache',
    // Each language is named in itself, in both locales.
    de: 'Deutsch',
    en: 'English',
  },
  // Garden views (T-73); the codes are the keys.
  view: {
    label: 'Ansicht',
    choose: 'Einfach oder Experte',
    SIMPLE: 'Einfach',
    EXPERT: 'Experte',
    description: {
      SIMPLE: 'Beet bepflanzen und Abstände und Nachbarn prüfen, ohne Zeitplanung.',
      EXPERT: 'Mit Zeitachse, Fruchtfolge, Erde erneuern und Anzucht.',
    },
  },
  apiError: {
    unauthorized: 'Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.',
    forbidden: 'Dafür fehlt dir die Berechtigung.',
    notFound: 'Das gibt es nicht mehr. Bitte lade die Seite neu.',
    tooManyRequests: 'Zu viele Anfragen. Bitte versuche es später noch einmal.',
    server: 'Der Server hat gerade ein Problem. Bitte versuche es gleich noch einmal.',
    offline:
      'Keine Verbindung zum Server. Prüfe deine Internetverbindung und versuche es noch einmal.',
    generic: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
  },
};

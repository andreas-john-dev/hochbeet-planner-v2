/** Profile page with its cards: account, appearance, language, garden and assistant. */
export const profile = {
  title: 'Profil',
  description: 'Konto und Einstellungen.',
  account: {
    title: 'Konto',
    signedInAs: 'Angemeldet als',
    admin: 'Admin',
  },
  appearance: {
    title: 'Darstellung',
    description: 'Wähle Hell, Dunkel oder die Einstellung deines Geräts.',
  },
  language: {
    title: 'Sprache',
    description: 'Gilt für die App in diesem Browser.',
  },
  garden: {
    title: 'Garten',
    description:
      'Dein letzter Frosttermin gilt jedes Jahr. Frostempfindliche Sorten kommen erst danach ins Freie, zum Beispiel im Aussaatkalender.',
    lastFrost: 'Letzter Frost',
    day: 'Tag',
    dayOption: '{{day}}.',
    month: 'Monat',
    saved: 'Gespeichert: letzter Frost am {{date}}.',
    reset: 'Auf {{date}} zurücksetzen',
  },
  assistant: {
    title: 'Beet-Assistent',
    description_one:
      'Der Assistent merkt sich Vorlieben aus euren Gesprächen, etwa was du nicht magst, wo du gärtnerst oder wie sonnig dein Beet steht. Die Gespräche selbst bleiben {{count}} Tag gespeichert.',
    description_other:
      'Der Assistent merkt sich Vorlieben aus euren Gesprächen, etwa was du nicht magst, wo du gärtnerst oder wie sonnig dein Beet steht. Die Gespräche selbst bleiben {{count}} Tage gespeichert.',
    memories: 'Gemerkte Vorlieben',
    loading: 'Vorlieben werden geladen',
    forgotten: 'Der Assistent hat alles vergessen.',
    empty: 'Noch keine Vorlieben gemerkt.',
    forget: 'Alles löschen',
    confirmTitle: 'Alles löschen, was der Assistent weiß?',
    confirmText:
      'Gelöscht werden alle gemerkten Vorlieben und die gespeicherten Gespräche. Das lässt sich nicht rückgängig machen.',
  },
};

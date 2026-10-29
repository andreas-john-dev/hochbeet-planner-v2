# Frontend und Mobile-UX

Teil der [Architektur](../architecture.md). React-SPA: Katalog, Beet-Editor, Anzucht, Barrierefreiheit, Bedienung nach Gerät, Laufzeitkonfiguration und Anmeldung.

Das Frontend ist eine React-SPA, die auf Desktop und Smartphone gleich gut bedienbar ist.

| Bereich | Wahl |
| --- | --- |
| Build | Vite, TypeScript strict |
| Design | Tailwind CSS + shadcn/ui (Radix), Light- und Dark-Mode |
| Routing | TanStack Router |
| Server-State | TanStack Query mit optimistischen Updates |
| Editor-State | Zustand, inklusive Undo/Redo |
| Formulare | react-hook-form + Zod aus `packages/contracts` |
| Drag & Drop | dnd-kit (Pointer-Sensor), Tastatur über einen eigenen Platzier-Modus |
| Zoom/Pan | Pinch-Zoom und Verschieben per Geste |
| Auth | Amplify Library (`aws-amplify/auth`), Login, Registrierung, Passwort vergessen |
| Datum | date-fns mit deutscher Locale |

## Katalogansicht

Umsetzung (Stand T-31):

- **Liste (`/katalog`):** Sorten mit Icon, Familie, Bedarf und Kennzeichnung „Angepasst“ bzw. „Eigene Sorte“. Suche über Name und Familie, Filter nach Kategorie (Chips), Bedarf (Chips, abwählbar) und Familie (Auswahlliste). Logik rein in `apps/web/src/lib/catalog.ts` (`filterCatalog`, `families`).
- **Detail (`/katalog/$plantId`):** alle Werte; geänderte Felder sind hervorgehoben und zeigen „angepasst (Standard: …)“ (`changedFields` vergleicht mit `global`). Gute und schlechte Nachbarn als Chips, die zur jeweiligen Sorte führen.
- **„Für mich anpassen“** (nur globale Sorten): Dialog für Abstand in der Reihe, Reihenabstand, Bedarf, Familie und Standzeit. Beim Speichern bildet `overrideFor` die vollständige Anpassung aus allen Feldern, die vom globalen Stand abweichen; weicht nichts mehr ab, wird sie gelöscht statt gespeichert. „Zurücksetzen“ ruft `DELETE …/override` auf. Danach lädt `useAdjustPlant` den Katalog neu, sodass Editor und Warnungen sofort mit den effektiven Werten rechnen.
- Nachbarlisten, Name, Farbe und Icon lassen sich per API anpassen, im Dialog aber noch nicht.
- **Aussaat & Anzucht** (T-49): einklappbarer Abschnitt `SowingFields` (`components/catalog/`) im Sortenformular (eigene Sorten, globale Sorten, Korrekturen) und im Dialog „Für mich anpassen“: frostempfindlich, Methode (keine Angaben, Direktsaat, Vorkultur, beides) und je Methode die Fenster in KW mit Hinweis „Anfang März“ (`weekHint()` in `lib/sowing.ts`), Vorkulturdauer, Pikieren, Zuschlag bei Direktsaat und Keimdaten. Felder der nicht gewählten Methode werden ignoriert. Formlogik in `lib/sowing-form.ts`, Fehler stehen am Feld. Im Dialog fehlt „Keine Angaben“, wenn die globale Sorte Angaben hat. Für Vergleiche gilt ein fehlendes `frostSensitive` wie `false` (`changedFields`, `overrideFor`). Detailseite und Admin-Vergleich zeigen die Angaben als Text (`sowingLines()`).
- **Aussaatkalender** (T-52): `SowingCalendar` (`components/catalog/`) auf der Detailseite nach den Werten. Ein Jahresband (ISO-Wochen des laufenden Jahres, Monatsachse an den Wochen ausgerichtet) mit den Zeilen Vorkultur, Direktsaat, Auspflanzen und Im Beet / Ernte; neben jeder Zeile steht derselbe Zeitraum als Text („KW 11–16 · Anfang März bis Mitte April“), die Balken selbst sind `aria-hidden`. Berechnung rein in `lib/sowing-calendar.ts` (`sowingCalendar()`):
  - Auspflanzen = Vorkulturfenster + Vorkulturdauer (früheste Aussaat + kürzeste Dauer bis späteste Aussaat + längste Dauer); frostempfindliche Sorten nicht vor der ersten Woche, die nach dem letzten Frost beginnt (`frostWeek()`; `SowingCalendar` gibt das Frostdatum aus dem Profil über `lastFrost` weiter, Standard 15. Mai).
  - Im Beet = ab Auspflanzen bzw. Direktsaat plus Standzeit, bei Direktsaat plus `directSowExtraWeeks`; beide Wege werden vereinigt. Mehrjährige Sorten laufen bis zum Jahresende („ab …, mehrjährig“).
  - Zeiträume über den Jahreswechsel werden für die Balken geteilt und im Text als einer genannt („KW 40–30“); KW 53 gilt in Jahren mit 52 Wochen als letzte Woche.
  - Darunter die Eckdaten (`sowingFacts()` aus `lib/sowing.ts`) und bei frostempfindlichen Sorten „erst nach dem 15. Mai ins Freie“. Ohne Angaben ein Hinweis, bei eigenen Sorten mit Link „Angaben ergänzen“.

Eigene Sorten (Stand T-32):

- **Formular** unter `/katalog/neu` und `/katalog/$plantId/bearbeiten` (nur eigene Sorten): alle Felder; Familie mit Vorschlägen aus dem Katalog; Standzeit als Auswahl mit Erklärung (eine Kultur, mehrere Jahre, Dauerkultur); Farbe; Icon aus `packages/plant-icons` oder das Kategorie-Icon, das dann der Kategorie folgt. Nachbarn werden per Suche hinzugefügt und als Chips entfernt; eine Sorte kann nicht zugleich guter und schlechter Nachbar sein. Logik in `apps/web/src/lib/plant-form.ts`.
- **Status** auf der Detailseite: privat, angefragt, veröffentlicht oder abgelehnt mit Kommentar der Admins. Abgelehnt ist im Contract `PRIVATE` mit `rejectionComment` (`publicationState()` in `lib/catalog.ts`).
- **„Für alle vorschlagen“** ruft `POST …/publication` auf; nach einer Ablehnung heißt der Knopf „Erneut vorschlagen“. Weil veröffentlichte Sorten nur auf globale Sorten verweisen dürfen, ist der Knopf gesperrt, solange eigene Sorten unter den Nachbarn stehen, und die App nennt sie.
- Eigene Sorten erscheinen sofort in Katalog und Palette des Editors und lassen sich wie globale Sorten pflanzen.

## Beet-Editor

Das Beet wird als SVG mit echtem cm-Maßstab gerendert, nicht als Canvas. SVG bleibt bei jedem Zoom scharf, und jede Pflanzung ist ein DOM-Knoten, den Playwright anklicken und ziehen kann.

- Das 5-cm-Raster wird je nach Zoom fein oder grob eingeblendet.
- Pflanzungen erscheinen als Icon der Sorte plus halbtransparente Standfläche in der Farbe der Sorte.
- Warnungen werden direkt am Objekt markiert (rot für Warnung, grün für gute Nachbarn, immer zusätzlich mit Symbol) und in einer Liste gesammelt.
- Beim Ziehen zeigt eine Vorschau die Warnungen live an, bevor man loslässt.
- Der Wochen-Slider steuert, welche Pflanzungen sichtbar sind.

Umsetzung (Stand T-30):

- **Route:** `/beete/$bedId` (`BedEditorPage`); jede Beetkarte verlinkt dorthin. Unbekannte Beete zeigen „Beet nicht gefunden“. Clientfehler (4xx) wiederholt TanStack Query nicht (`shouldRetry` in `lib/api.ts`).
- **Ansicht:** Der Viewport (`lib/editor/viewport.ts`) besteht aus Verschiebung in px und Maßstab in px pro cm. Er wird in einen `viewBox` umgerechnet, sodass alle Formen in cm gezeichnet werden. Beim ersten Messen passt er das Beet mit Rand ein. Zoom hält den Punkt unter Mauszeiger bzw. Fingern fest (Maßstab 0,05 bis 40 px/cm).
- **Raster:** Die Rasterweite wird aus 5, 10, 25, 50 und 100 cm so gewählt, dass Linien mindestens 8 px auseinanderliegen. Hauptlinien kommen alle 50 bzw. 100 cm; Linien haben unabhängig vom Zoom eine feste Strichstärke.
- **Pflanzungen:** Jede Pflanzung ist ein `<g data-testid="planting-<id>">` (mit `data-plant-id`, `data-kind`, `data-x`, `data-y` und bei Reihen `data-length-cm`) mit Standfläche und einem Icon je Pflanze. Bei Reihen gilt das für jede Pflanze im Abstand in der Reihe. Die Icons sind 8 bis 24 cm groß. Gezeigt werden die Pflanzungen der gewählten Woche.
- **Gesten:** Mausrad zoomt, Ziehen verschiebt, zwei Finger zoomen und verschieben (Pointer Events, `touch-action: none`). Zusätzlich gibt es Buttons für Vergrößern, Verkleinern und Einpassen.
- **Wochen-Slider (`components/editor/WeekSlider.tsx`):**
  - Die gewählte Woche (Montag als ISO-Datum) liegt im Editor-Store und startet mit der aktuellen Woche.
  - Der Slider deckt alle Montage im Jahr der gewählten Woche ab und ist mit Monatsnamen beschriftet (auf dem Smartphone nur die Anfangsbuchstaben). Daneben stehen „4. – 10. Mai 2026 · KW 19“ und die Buttons Woche zurück, Woche vor und „Heute“. Über den Jahreswechsel hinweg wechselt der Slider ins andere Jahr.
  - Die Woche bestimmt die sichtbaren Pflanzungen, den Start neuer Pflanzungen und „Entfernen ab“.
  - **Geister** (`ghosts()` in `lib/editor/timeline.ts`): Für jede Pflanzung der Woche erscheinen der direkte Vorgänger an derselben Stelle und der direkte Nachfolger blass (30 % Deckkraft) und gestrichelt. Der Vorgänger endet spätestens am Start der Pflanzung, der Nachfolger beginnt frühestens an ihrem Ende und nach der Woche. Dabei überlappen sich die Standflächen. Geister sind nicht anklickbar (`data-testid="ghost-<id>"`, `data-ghost="before" | "after"`). Dauerkulturen ohne Ende haben keinen Nachfolger.
- **Warnungen (`lib/editor/warnings.ts`, `components/editor/FindingsList.tsx`):**
  - `evaluateBed` läuft im Editor bei jeder Änderung über alle Pflanzungen des Beets. Dazu zählen auch die gerade gezogene Pflanzung (Entwurf) und die Vorschau beim Setzen, sodass eine Warnung schon vor dem Loslassen erscheint. Gespeichert wird trotzdem immer.
  - **Markierung am Objekt** für die gewählte Woche: ein Abzeichen oben rechts an der Standfläche, gleich groß bei jedem Zoom; Farbe immer zusammen mit einem Symbol.
    - Warnung: rot „!“, dazu ein roter Umriss.
    - Hinweis (Beetrand): grau „i“.
    - Gute Nachbarn: grün „✓“.
    - Pro Pflanzung zählt der schwerste Befund. Der Status steht auch im Namen für Screenreader („Tomate (Warnung)“).
  - **Liste „Hinweise dieser Saison“** unter dem Editor, mit deutschem Text, Zeitraum in Kalenderwochen und einer Zusammenfassung („2 Warnungen · 1 Hinweis“).
    - Saison = von einer Erneuerung der Erde bis zur nächsten (`seasonOf`, Standard 1. März).
    - Befunde außerhalb der gewählten Woche sind blasser.
    - Ein Klick hebt die betroffenen Pflanzungen mit einem Ring hervor und springt in ihre erste Woche (oder bleibt in der aktuellen, wenn der Befund dort gilt). Ein zweiter Klick oder Escape hebt die Markierung auf.
  - **Übersicht:** Jede Beetkarte zeigt die Warnungen der laufenden Saison als Zähler.
- **Saisongrenze:** In den Beet-Einstellungen („Beet bearbeiten“ auf der Karte oder im Editor-Kopf) steht der Abschnitt „Erde erneuert“ (`components/beds/SoilRenewalsField.tsx`, Logik in `lib/soil-renewals.ts`).
  - Die Übersicht je Jahr zeigt das Vorjahr, das laufende und das nächste Jahr sowie jedes Jahr mit eigenen Terminen. Ohne eigenen Termin steht dort „1. März (Standard)“ mit „Anpassen“, das den Standard als eigenen Termin übernimmt.
  - Eigene Termine sind Datumsfelder mit „Entfernen“; „Erneuerung hinzufügen“ legt einen weiteren an. Leere Felder werden verworfen, doppelte Daten abgelehnt.
  - Eigene Termine eines Jahres ersetzen den 1. März dieses Jahres (wie in `soilRenewalsIn`). Der Dialog weist darauf hin.
  - Die Erneuerungen des Slider-Jahres erscheinen als Markierungen auf dem Wochen-Slider (`data-testid="renewal-mark"`, Text „Erde erneuert am …“).
- **Pflanzen hinzufügen (Desktop):**
  - Die Seitenleiste „Pflanzen hinzufügen“ (ab `md`) bietet Suche, Kategorie-Filter, Icons und den Umschalter Einzelpflanze/Reihe.
  - Sorten werden mit dnd-kit (Pointer-Sensor, ab 5 px Bewegung) ins Beet gezogen. Die Vorschau rastet auf 5 cm ein und bleibt im Beet.
  - Eine Reihe läuft in der Hauptreihenrichtung des Beets, zunächst bis zum Rand, höchstens 50 cm. Danach ist sie ausgewählt, und ihr Griff (`role="slider"`) zieht sie in 5-cm-Schritten auf Länge, auch mit den Pfeiltasten.
  - Pflanzdatum ist der Montag der gewählten Woche, das Ende kommt aus dem Lebenszyklus der Sorte.
  - Die Logik liegt rein in `lib/editor/placement.ts` und `lib/editor/palette.ts`.
- **Tastatur:** Statt des Keyboard-Sensors von dnd-kit gibt es einen eigenen Platzier-Modus.
  - Enter auf einer Sorte setzt eine Vorschau in die Beetmitte und fokussiert das Beet. Pfeiltasten verschieben um 5 cm (mit Umschalt 25 cm), Enter oder ein Klick setzt, Escape bricht ab.
  - Grund: Der Keyboard-Sensor bewegt in Bildschirmpixeln, ausgehend von der Palette. Ein Cursor in Beet-cm passt besser zum Raster und lässt sich ansagen (Live-Region unter dem Beet).
- **Bearbeiten (Desktop):**
  - Pflanzungen sind fokussierbare Buttons (`aria-pressed` = ausgewählt). Klick oder Fokus wählt aus, ein Klick ins Leere oder Escape hebt die Auswahl auf.
  - Mit der Maus gezogen rastet die Pflanzung auf 5 cm ein. Pfeiltasten verschieben die fokussierte Pflanzung (mit Umschalt um 25 cm), Entf löscht sie. Per Touch bleibt Ziehen ein Verschieben der Ansicht; Long-Press kommt mit T-27.
  - Jede ausgewählte Reihe hat ihren Griff.
  - Nach dem Setzen wird nur eine Reihe ausgewählt (für den Griff); nach einer Einzelpflanze bleibt die Palette sichtbar.
- **Detailpanel:** Es ersetzt die Palette, solange etwas ausgewählt ist.
  - Inhalt: Sorte, Position, echte Daten mit KW und Herkunft des Endes (Standzeit, angepasst, entfernt). Ein beim Anlegen vorbelegtes Ende gilt als „aus der Standzeit“.
  - „Ins Beet gekommen als“: Umschalter Direktsaat / Gepflanzt (`origin`), mit Hinweis auf den Zuschlag der Sorte; `withOrigin()` in `lib/editor/details.ts` passt ein vorbelegtes Ende an, ein von Hand gesetztes bleibt. Läuft wie jede Änderung über die Undo-Historie.
  - „Ende anpassen“: Datumsfeld; leer heißt Ende aus der Standzeit. Ändert sich das Ende von außen (Umschalten, Undo), übernimmt das Feld den neuen Wert, ohne das Panel neu aufzubauen.
  - „Entfernen ab KW …“ setzt `removedDate` auf den Montag der im Editor gewählten Woche und ist gesperrt, wenn die Pflanzung später beginnt. Eine entfernte Pflanzung lässt sich wieder ins Beet nehmen.
  - „Pflanzung löschen“ löscht ohne Rückfrage, weil es sich rückgängig machen lässt.
- **Undo/Redo:** Buttons „Rückgängig“/„Wiederholen“ sowie Strg+Z und Strg+Umschalt+Z (oder Strg+Y); in Textfeldern bleibt das native Undo.
  - Jede Änderung ist ein Paar `{ before, after }` (`lib/editor/history.ts`, höchstens 100 Schritte je geöffnetem Beet, nicht gespeichert).
  - Undo schickt den Zustand `before` an die API: PUT, DELETE oder POST für eine gelöschte Pflanzung. Weil der Server beim Anlegen eine neue ID vergibt, ersetzt `remapId` die alte ID in der ganzen Historie.
- **Smartphone (unter `md`, `useMediaQuery` in `lib/media-query.ts`):**
  - Statt Seitenleisten gibt es Bottom-Sheets (`components/ui/sheet.tsx`, Radix Dialog).
  - **Pflanze hinzufügen:** Der Button unter dem Beet öffnet die Palette als Sheet; deren Einträge sind einfache Buttons, damit die Liste per Finger scrollt. Nach der Wahl schließt das Sheet und die Vorschau steht in der Beetmitte. Ein Tipp aufs Beet setzt sie dorthin (5-cm-Raster). „Hier pflanzen“ bestätigt, „Abbrechen“ verwirft.
  - **Bearbeiten:** Ein Tipp auf eine Pflanzung öffnet das Detailpanel als Sheet (`inspecting` im Store). Ein Long-Press-Verschieben öffnet es nicht, damit das Beet sichtbar bleibt.
  - **Verschieben:** Ein Finger verschiebt die Ansicht, zwei zoomen. Bleibt der Finger 200 ms auf einer Pflanzung, folgt sie ihm im Raster (mit kurzer Vibration, wo verfügbar).
    - Bewegt er sich vorher oder kommt ein zweiter Finger dazu, bleibt es Pan bzw. Pinch.
    - Entscheidend ist der Zeitstempel des Events, nicht seine Verarbeitung: Ist der Hauptthread kurz blockiert, wird ein Wisch nicht zum Verschieben.
  - **Browsergesten:** Auf dem Beet unterdrückt ein nicht-passiver `touchstart`-Handler die Gesten des Browsers (Long-Press-Menü, Auswahl). Sonst verschluckt Android nach einem langen Druck den nächsten Tipp. Pointer Events kommen weiter an.
  - **Kein Doppeltipp-Zoom:** `touch-action: manipulation` auf `html`; Pan und Pinch-Zoom der Seite bleiben.
  - **Touch-Ziele** in Sheets und unter dem Beet sind mindestens 44 px hoch.
- **Undo-Warteschlange:** Rückgängig und Wiederholen werden nicht mehr verworfen, solange eine Anfrage läuft. Sie werden eingereiht und nacheinander ausgeführt, sobald keine Anfrage mehr offen ist (`queryClient.isMutating()`). So gehen schnelle Strg+Z nicht verloren, und temporäre IDs sind vorher aufgelöst.
- **State:** Ein Zustand-Store je geöffnetem Beet (`lib/editor/store.ts`) hält Größe, Viewport, Pflanzart, Vorschau, Auswahl, den Entwurf beim Ziehen (Position oder Länge) und die Undo-Historie.
- **Speichern:** Für Pflanzungen gibt es `useSavePlanting` und `useDeletePlanting` in `lib/garden.ts`. Sie ändern den Query-Cache optimistisch, rollen bei Fehlern zurück und laden danach neu. Neue Pflanzungen tragen bis zur Antwort eine temporäre ID (`tmp-…`); erst danach erscheint der Griff.

## Barrierefreiheit und Feinschliff

Umsetzung (Stand T-35):

- **WCAG 2.1 AA:** `e2e/tests/a11y.spec.ts` prüft jede Seite aus `pages.ts` in Light- und Dark-Mode mit axe-core (Kontraste, Namen, Landmarks, Überschriften) in allen drei Playwright-Projekten. Dazu prüft ein Test per Tabulator, dass jedes fokussierte Element einen sichtbaren Fokus hat.
- **Fokus:** Ein globaler `:focus-visible`-Rahmen (2 px in `--ring`) gilt für alles ohne eigenen Fokusring, z. B. die Navigation; Bedienelemente mit eigenem Ring behalten ihn.
- **Ladezustände:** Skelette (`components/ui/skeleton.tsx`) in Form der Inhalte statt reiner Ladetexte; Screenreader hören den Ladetext einmal über `role="status"`.
- **Fehlermeldungen:** `apiErrorMessage()` nimmt die deutsche Meldung des Service und unterscheidet sonst abgelaufene Anmeldung (401), fehlende Berechtigung (403), nicht mehr Vorhandenes (404), Serverprobleme (5xx) und fehlende Verbindung. Fehlerseiten von Proxys, die kein JSON sind, behalten ihren Status.
- **Übergänge:** Seiten blenden kurz ein, das Abdunkeln hinter Dialogen ebenso; mit „Bewegung reduzieren“ entfällt beides. Dialoginhalte selbst bewegen sich nicht, damit Fokus und Scrollposition beim Öffnen stabil bleiben.
- **Lighthouse:** `pnpm --filter e2e lighthouse` misst den Produktions-Build in `vite preview` (Mock-Auth und -API aus `config.dev.json`) mit dem mobilen Preset: Anmeldung, Beetübersicht, Editor und Katalog müssen bei Performance und Accessibility mindestens 90 erreichen. Der CI-Job `lighthouse` lädt die Berichte als Artefakt hoch. Lighthouse läuft per `npx` in fester Version statt als Abhängigkeit, weil es `@opentelemetry/api` in den Workspace zieht und damit vitest doppelt auflöst.
- **375 px:** `shell.spec.ts` prüft weiterhin jede Seite auf horizontales Scrollen.

## Bedienung nach Gerät

| Aktion | Desktop | Smartphone |
| --- | --- | --- |
| Pflanze hinzufügen | Aus der Seitenleiste ins Beet ziehen | Sorte im Bottom-Sheet wählen, aufs Raster tippen, bestätigen |
| Verschieben | Ziehen | Long-Press (ca. 200 ms), dann ziehen |
| Reihe aufziehen | Startpunkt ziehen, Länge per Griff | Startpunkt tippen, Länge per Griff |
| Zoom/Pan | Mausrad und Ziehen des Hintergrunds | Pinch und Wischen |
| Details bearbeiten | Seitenpanel | Bottom-Sheet |

Auf dem Smartphone ist Zoom Pflicht: Ein 120 cm breites Beet ergibt auf 375 px nur etwa 15 px pro Rasterzelle. Touch-Ziele sind mindestens 44 px groß.

## Konfiguration zur Laufzeit

Die SPA lädt beim Start eine `config.json` mit UserPool-ID, Client-ID und Region und übergibt sie an `Amplify.configure`. Die Datei schreibt CDK beim Deploy in den Bucket. API-Aufrufe gehen relativ an `/api/...` auf derselben Domain.

```json
{ "region": "eu-central-1", "userPoolId": "eu-central-1_…", "userPoolClientId": "…" }
```

## Anmeldung

- **Auth-Adapter:** Die App spricht Cognito nur über das Interface `AuthAdapter` (`apps/web/src/lib/auth/`) an. In prod steckt Amplify dahinter (`aws-amplify/auth`, SRP, ohne Hosted UI). Der Dev-Server liefert `config.json` aus `apps/web/config.dev.json` mit `"authMode": "mock"`; dann übernimmt ein lokaler Mock mit Testusern (`test@example.com`, `admin@example.com`, Passwort `Gemuese1!`, Bestätigungscode `123456`). Der Mock wird nur in diesem Fall nachgeladen und läuft in prod nie.
- **Lokale API (`apps/web/src/lib/local-api/`):** Garden-Service (Beete, Pflanzungen, Anzucht-Chargen, Einstellungen) und der User-Teil des Catalog-Service (Katalogliste, eigene Sorten, Anpassungen) laufen auch komplett im Browser. Das ist Produktionscode und Grundlage für den Gastmodus (Epic #84).
  - `localRoutes({ repo, globals })` beantwortet die Routen mit denselben Contract-Schemas, Statuscodes und deutschen Fehlermeldungen wie die Services. `repo` liest und schreibt die Daten genau eines Users, `globals` liefert den globalen Katalog, auf dem Anpassungen und eigene Sorten aufbauen. IDs sind ULIDs aus dem Client.
  - Ein kleiner eigener Router (`router.ts`) ordnet Methode und Pfad zu, statt MSW zu nutzen: Produktionscode hängt so nicht an einer Mock-Bibliothek, und der Mock-Chunk ist von rund 330 kB auf 11 kB geschrumpft. Unbekannte Routen geben 404, ein voller Browser-Speicher (`QuotaExceededError`) 507 mit deutscher Meldung.
  - `createLocalFetch({ globals })` ist das `fetch` für Gäste und speichert unter dem Schlüssel `hochbeet-guest` im `localStorage`, als Umschlag `{ version, garden }`. Beim Lesen wird älterer Inhalt über Migrationsschritte (`migrations` in `store.ts`) auf die aktuelle Version gebracht und eintragsweise per zod geprüft: Ungültige Beete, Pflanzungen, Chargen, Anpassungen oder Sorten fallen einzeln weg, ebenso Pflanzungen ohne Beet; eine `sowingId` auf eine gelöschte Charge bleibt wie im Garden-Service stehen. Versionen: 2 bringt `origin` an Pflanzungen (T-51), 3 die Anzucht-Chargen (`sowings`, alte Daten starten mit einer leeren Liste, T-56). Unlesbarer Inhalt (kaputtes JSON, unbekannte oder neuere Version) wandert einmal nach `hochbeet-guest-backup`, und die App startet leer statt abzustürzen.
  - Veröffentlichen beantwortet die lokale API für Gäste mit 403; Admin-Routen gibt es dort nicht.
  - Das Modul wird nur per `import()` geladen und landet nicht im Haupt-Bundle.
  - `publicCatalog(baseFetch)` lädt den globalen Katalog einmal pro Sitzung über die öffentliche Route (`GET /api/catalog/public/plants`). Ist sie nicht erreichbar, antwortet die lokale API mit 503 und einer deutschen Meldung und versucht es beim nächsten Request erneut.
- **Gastmodus** (Epic #84, T-38): Besucher planen ohne Konto, ihre Daten bleiben im Browser.
  - Start über „Ohne Konto ausprobieren“ auf Anmelde- und Registrierungsseite. `useAuth()` liefert dann `guest: true` und keinen `user`; das Flag `hochbeet-guest-mode` im `localStorage` hält den Modus über Reloads. Eine Anmeldung beendet ihn immer; ein angemeldeter User ist nie zugleich Gast.
  - `ApiProvider` gibt Gästen einen API-Client ohne Token, dessen `fetch` die lokale API beim ersten Aufruf nachlädt (`createLocalFetch()` auf `hochbeet-guest`). Nur der öffentliche Katalog geht an den Server; Garden-Service und User-Routen des Catalog-Service sehen von Gästen keinen einzigen Request. UI und Query-Hooks sind für Gäste und User dieselben.
  - Jede Identität (User, Gast, abgemeldet) bekommt einen eigenen Query-Cache, damit nach einem Wechsel keine zwischengespeicherten Daten der vorherigen sichtbar sind.
  - Router: Gäste dürfen in den App-Bereich (`/beete`, Editor, Katalog, eigene Sorten). `/profil` und `/admin` schicken sie wie Abgemeldete zur Anmeldung; in der Navigation fehlen beide (`accountOnly` in `nav-items.ts`). „Für alle vorschlagen“ ersetzt ein Hinweis zur Anmeldung.
  - Ein Hinweis über jeder Seite (`GuestBanner`) sagt, dass die Beete nur in diesem Browser liegen, und verlinkt Registrierung und Anmeldung. „Gastmodus beenden“ fragt, ob die Daten für später bleiben oder gelöscht werden.
  - Meldet sich ein Gast an oder registriert sich, bleiben seine lokalen Daten erhalten, bis er sie übernimmt oder verwirft (siehe [Übernahme aus dem Gastmodus](./garden.md#übernahme-aus-dem-gastmodus)).
- **Mock-API:** Mit `"apiMode": "mock"` in `config.dev.json` beantwortet `createMockFetch()` (`apps/web/src/mocks/`) alle Aufrufe unter `/api/*` direkt im Browser, ohne Service-Worker. Wie der Auth-Mock wird sie nur in diesem Fall nachgeladen.
  - Sie nimmt pro Request den User aus dem Mock-Token und nutzt für ihn die lokale API (`localRoutes()` mit `MockStore.repository(userId)`). Dazu kommen die Routen, die es nur für angemeldete User gibt und die über User hinweg arbeiten: Veröffentlichung und Admin (`mockRoutes()` in `handlers.ts`).
  - Daten liegen pro Testuser im `localStorage` (`hochbeet-mock-api`), der globale Katalog liegt gemeinsam für alle Testuser daneben (`hochbeet-mock-catalog`, Startkatalog, bis Admins ihn ändern). Der Mock-Token `mock-id-token.<email>|admins` trägt die Gruppen wie `cognito:groups`; ohne Token antwortet sie mit 401, außer für den öffentlichen Katalog (`publicRoutes()`).
  - Playwright startet jeden Test mit leerem Speicher und kann Daten per `addInitScript` vorbelegen.
- **API-Zugriff:** `ApiProvider` stellt `useApi()` bereit. Die Query-Hooks liegen in `apps/web/src/lib/garden.ts` (`useBeds`, `useBedWithPlantings`, `usePlants`, `useSaveBed`, `useDeleteBed`, `useSavePlanting`, `useDeletePlanting`, `useSowings`, `useSaveSowing`, `useDeleteSowing`, `useAdjustPlant`, `useSaveOwnPlant`, `useRequestPublication`, `usePublicationQueue`, `useDecidePublication`, `useSaveGlobalPlant`). Nach Änderungen wird die Beetliste neu geladen. Weil die verplante Menge einer Charge aus den Pflanzungen kommt, laden Änderungen an Pflanzungen und das Löschen eines Beets auch die Chargen neu.
- **Profil (`/profil`):** Karten „Konto“, „Darstellung“, „Garten“ und für Assistenz-Tester „Beet-Assistent“. „Garten“ (`components/profile/GardenSettingsCard.tsx`, T-53) stellt den letzten Frost mit zwei Auswahllisten (Tag, Monat) ohne Jahr ein; der Tag bleibt im Monat (31. März → 30. April). „Speichern“ und „Auf 15. Mai zurücksetzen“ schreiben über `useSaveGardenSettings()`, gelesen wird mit `useGardenSettings()` (`lib/garden.ts`); Texte und Monatslogik in `lib/garden-settings.ts`.
- **Beetübersicht (`/beete`):**
  - Kartenraster mit maßstäblicher Mini-Vorschau. Sie zeigt die Standflächen der Pflanzungen, die in der laufenden Woche im Beet stehen, in der Farbe der Sorte.
  - Dialog „Beet anlegen“ bzw. „Beet bearbeiten“ mit Name, Breite, Tiefe und Reihenrichtung. Die Reihenrichtung ist als Skizze erklärt und folgt dem Standard (parallel zur kürzeren Kante), bis der User selbst wählt.
  - Löschen fragt nach und weist darauf hin, dass die Pflanzungen mitgelöscht werden.
  - Ohne Beete erscheint ein leerer Zustand mit der Einladung zum ersten Beet.
- **Anzucht (`/anzucht`, T-57):** `routes/SowingsPage.tsx` mit `components/sowings/` (`SowingCard`, `SowingFormDialog`, `DeleteSowingDialog`); Logik in `lib/sowings.ts`, Daten über `useSowings()` und `usePlants()`. Auch für Gäste, Navigationspunkt „Anzucht“ zwischen „Beete“ und „Katalog“.
  - Chargen gruppiert nach Jahr (neuestes zuerst), im Jahr nach Aussaatwoche; Filter „Aktiv“ (Phase ≠ `DONE`, Standard), „Abgeschlossen“, „Alle“.
  - Jede Karte zeigt Icon, Sorte, Aussaatwoche (`formatWeek()`), Phase, Standort, geplantes Auspflanzen, Notiz und den Bestand: vor der Keimung „24 gesät“ bzw. „24 geplant“, danach „lebend 18 · verplant 12 · frei 6“. Verplant ist `plannedCount()` mit der effektiven Sorte; ist die Sorte unbekannt, steht „–“, und frei darf negativ werden, wenn mehr verplant ist, als lebt.
  - Schnellaktionen unten auf der Karte (auf dem Telefon mit dem Daumen erreichbar, 44 px hoch): „Weiter: <Phase>“ bis „Abhärten“, beim Schritt auf „Gekeimt“ wird der Bestand mit der gesäten Menge vorbelegt („18 von 24 gekeimt“); Stepper für den Bestand ab der Keimung; „Abschließen“ (Bestand 0, Phase `DONE`); Bearbeiten; Löschen mit Rückfrage, die verknüpfte Pflanzungen und ihre Beete nennt. Jede Aktion speichert sofort.
  - Dialog „Neue Anzucht“: Sorte per Suche (Sorten mit Vorkultur zuerst, `plantsForSowing()`), Aussaatwoche als Datum, das auf den Montag fällt, gesäte Menge, Standort, Notiz. Das geplante Auspflanzen folgt Sorte und Woche (`defaultTransplantDate()`: Aussaat plus `propagationWeeks.max`, bei frostempfindlichen Sorten frühestens der Montag nach dem letzten Frost des Users), bis der User es selbst setzt. Neue Chargen ab der laufenden Woche sind gesät, spätere geplant; der Bestand beginnt bei 0. Bearbeiten ändert zusätzlich Phase und Bestand.
  - Auf allen Breiten Karten (ab `lg` zwei Spalten) statt einer Tabelle: Eine Charge hat zu viele Aktionen für eine Tabellenzeile.
  - Ohne Chargen ein leerer Zustand mit Erklärung und Link zum Katalog (dort zeigt jede Sorte ihren Aussaatkalender).
- **Seiten:** `/anmelden`, `/registrieren` (mit Bestätigungscode) und `/passwort-vergessen`, mit react-hook-form, Zod und deutschen Fehlermeldungen. Die Passwortregeln spiegeln die Policy des User Pools. Fehler bei der Anmeldung verraten nicht, ob ein Konto existiert.
- **Geschützte Routen:** Alles außer den drei Auth-Seiten und der Entwicklerseite `/dev/icons` verlangt eine Anmeldung. Ohne Login leitet der Router auf `/anmelden?redirect=<Pfad>` um und kehrt danach dorthin zurück; Weiterleitungen gehen nur auf Pfade der App. Der Admin-Bereich und sein Navigationseintrag erscheinen nur für die Gruppe `admins` (Claim `cognito:groups` im ID-Token); alle anderen sehen unter `/admin` eine 403-Seite. Das ist reine Bedienführung; geschützt werden die Admin-Daten im Catalog-Service.
- **API-Client:** `createApiClient()` in `apps/web/src/lib/api.ts` sendet das ID-Token als `Authorization: Bearer …` an `/api/...`.

# Pflanzenkatalog und Catalog-Service

Teil der [Architektur](../architecture.md). Globale und eigene Sorten, Anpassungen, Veröffentlichung, Admin, Startkatalog, Icons und der Service dahinter.

## Pflanzenkatalog

Jeder User sieht eine effektive Sicht aus drei Quellen: globale Sorten, eigene Sorten und persönliche Anpassungen. Nur eigene Sorten können zur Publikation angefragt werden.

| Quelle | Wer pflegt | Sichtbar für | Publizierbar |
| --- | --- | --- | --- |
| Globale Sorte | Admin | Alle | – (bereits global) |
| Eigene Sorte | Der User selbst | Nur den User | Ja, per Anfrage |
| Persönliche Anpassung | Der User selbst | Nur den User | Nein |

### Persönliche Anpassungen

Eine Anpassung ist ein Overlay auf eine globale Sorte: effektive Sorte = `{...global, ...override}`. Anpassbar sind alle fachlichen Felder, auch Abstände und Nachbarlisten. Angepasste Sorten sind im UI markiert und lassen sich auf den globalen Stand zurücksetzen.

### Publikations-Workflow

1. Der User legt eine eigene Sorte an (Status `PRIVATE`).
2. Er fragt die Publikation an (Status `PENDING`); die Sorte bleibt für ihn weiter nutzbar.
3. Der Admin prüft die Anfrage in einer Warteschlange und kann Werte vor der Freigabe korrigieren.
4. Bei Freigabe wird die Sorte global (Status `PUBLISHED`) und **behält ihre ID**. Bestehende Pflanzungen funktionieren ohne Migration weiter. Spätere Änderungen des ursprünglichen Users werden zu persönlichen Anpassungen.
5. Bei Ablehnung geht die Sorte mit einem Kommentar zurück auf `PRIVATE`.

Eigene Sorten, die in Pflanzungen verwendet werden, werden nur archiviert und nicht hart gelöscht. Nachbarlisten globaler Sorten dürfen nur auf globale Sorten verweisen.

### Admin

Admins sind Mitglieder der Cognito-Gruppe `admins`. Der Catalog-Service prüft den Claim `cognito:groups` auf allen `/admin/*`-Routen. Das Admin-UI ist ein geschützter Bereich derselben SPA und pflegt globale Sorten sowie die Publikationswarteschlange.

Umsetzung des Admin-UI (Stand T-33):

- **`/admin`:** Warteschlange der offenen Anfragen (älteste zuerst) und die globalen Sorten mit Suche und „Globale Sorte anlegen“.
- **`/admin/anfragen/$plantId`:** Die Anfrage steht in einer Tabelle neben bis zu drei ähnlichen globalen Sorten (`similarPlants()` in `apps/web/src/lib/admin.ts`). Ähnlich heißt: gemeinsamer Namensteil ab fünf Buchstaben, sonst gleiche Familie. Das Formular erlaubt Korrekturen vor der Freigabe; „Freigeben“ schickt nur die geänderten Felder als `corrections`. „Ablehnen“ verlangt eine Begründung, die die anfragende Person bei ihrer Sorte sieht.
- **`/admin/sorten/neu` und `/admin/sorten/$plantId`:** globale Sorten anlegen und ändern, mit den globalen Werten (ohne persönliche Anpassung des Admins); Nachbarn nur aus dem globalen Katalog.
- **Kein Admin:** Der Navigationseintrag fehlt, und ein direkter Aufruf eines `/admin`-Pfads zeigt eine 403-Seite „Kein Zugriff“ statt einer Weiterleitung (`AdminLayout`). Geschützt sind die Daten weiterhin im Catalog-Service.
- Das Sortenformular ist dafür eine gemeinsame Komponente (`components/catalog/PlantFormFields.tsx`) für eigene Sorten, globale Sorten und Korrekturen.

### Startkatalog

Der Startkatalog mit 56 Sorten steht in [`docs/startkatalog.md`](../startkatalog.md). Er wird als typisiertes Paket `packages/catalog-seed` gepflegt und beim Deploy per Custom Resource eingespielt.

Umsetzung in `packages/catalog-seed`:

- `src/data.ts` enthält die Sorten wie in der Tabelle, inklusive der Kurzformen in den Nachbarlisten. Jede Sorte hat eine feste ULID; sie wird nie geändert, weil Pflanzungen und Anpassungen darauf verweisen.
- `resolveSeed()` löst die Kurzformen auf: Kohl, andere Kohlarten (ohne die Sorte selbst), Sellerie, Bohnen und „wie X“. Bei „wie X“ übernimmt die Sorte die rohen Listen von X; „andere Kohlarten“ wird danach für die übernehmende Sorte aufgelöst. Unbekannte Namen werfen einen Fehler. Eine Sorte steht nie in ihrer eigenen Liste.
- Danach macht `resolveSeed()` die Listen symmetrisch: Jede Sorte bekommt auch die Sorten, die sie selbst nennen (nach den eigenen Einträgen, in Katalogreihenfolge). „Warnung sticht“: Ein Paar, das eine Seite als schlecht führt, steht bei keiner Seite unter den guten. So zeigen Katalog, Beet-Assistent und Regeln dieselben Nachbarn, auch wenn die Quelle das Paar nur bei einer Sorte nennt (z. B. Basilikum bei Tomate). `data.ts` trägt ein Paar deshalb nur auf der Seite ein, deren Quelle es nennt.
- Exportiert werden `seedPlants` (fertige `Plant`-Objekte) und `seedPlantByName`.
- Icon-Schlüssel sind der Sortenname in Kleinbuchstaben mit Bindestrichen, Umlaute ausgeschrieben, z. B. `rote-bete`, `fruehlingszwiebel`. `packages/plant-icons` liefert die passenden SVGs.
- Tests prüfen das Zod-Schema, die Nachbar-Referenzen und die Kurzformen. Widersprüche (gut auf einer, schlecht auf der anderen Seite) listet der Testreport `packages/catalog-seed/report/contradictions.md`; er vergleicht die einseitigen Listen aus `resolveOneSided()`. Die Tabelle wendet „Warnung sticht“ bereits an und enthält aktuell keine.
- Ändert sich der Seed einer Sorte, schreibt `Custom::CatalogSeed` sie beim Deploy neu (`seedHash`); Admin-Korrekturen an genau dieser Sorte werden dabei überschrieben. Anpassungen der User (Overlay) bleiben erhalten und überdecken weiterhin die globalen Werte.

### Pflanzen-Icons

`packages/plant-icons` enthält ein handgezeichnetes Icon pro Sorte des Startkatalogs und je ein Kategorie-Icon (`category-gemuese`, `category-obst`, `category-kraut`).

- Stil: `viewBox` 0 0 48 48, flache Formen ohne Verläufe, höchstens drei Farben pro Icon, lesbar ab 24 px. Mindestens eine Farbe hat zu beiden Seitenhintergründen (hell und dunkel) einen Kontrast von 3:1. Tests prüfen das für jedes Icon.
- Icons sind Daten statt SVG-Dateien: eine Liste von Pfaden mit Füllung oder Linie (`src/icons/*.ts`, Hilfsfunktionen in `src/shapes.ts`). Das hält sie typsicher und prüfbar.
- `@hochbeet/plant-icons` exportiert die Daten ohne React (`ICONS`, `PLANT_ICON_KEYS` für die Icon-Auswahl eigener Sorten, `resolveIconKey()`), `@hochbeet/plant-icons/react` die Komponenten.
- `<PlantIcon plant size />` nimmt die Sorte (`icon`, `category`, `name`) statt einer `plantId`. Abweichung vom Issue: Das Paket kennt den Katalog des Users nicht; die Sorte zur `plantId` holt der Aufrufer aus dem Katalog. Unbekannte Icon-Schlüssel fallen auf das Kategorie-Icon zurück. Der Sortenname ist das zugängliche Label; `decorative` blendet das Icon für Screenreader aus, wenn der Name daneben steht.
- Die Galerie `/dev/icons` zeigt alle Icons in 24, 32 und 48 px. Sie ist öffentlich und braucht keine Daten; Playwright-Screenshots in Hell und Dunkel sichern sie ab.

## Catalog-Service

| PK | SK | Inhalt |
| --- | --- | --- |
| `GLOBAL` | `PLANT#<id>` | Globale Sorte |
| `USER#<uid>` | `PLANT#<id>` | Eigene Sorte |
| `USER#<uid>` | `OVERRIDE#<plantId>` | Persönliche Anpassung |
| `USER#<uid>` | `IMPORT#<importId>` | Stand eines Imports aus dem Gastmodus (ID-Zuordnung, Antwort) |

Ein GSI (`GSI1PK = PUBLICATION#PENDING`, `GSI1SK = <angefragt am>`) liefert die Admin-Warteschlange. Die effektive Sicht eines Users entsteht aus zwei Queries; die globalen Sorten werden in der Lambda für einige Minuten gecacht.

Schlüsselnamen und Index stehen in `services/catalog/src/table.ts` (`catalogTable`); der Stack legt die Tabelle daraus an.

**Seed:** Die Custom Resource `Custom::CatalogSeed` in `Prod-CatalogStateful` spielt den Startkatalog als globale Sorten ein (`PK = GLOBAL`, `SK = PLANT#<id>`). Der Handler liegt in `services/catalog/src/seed/handler.ts` und wird mit esbuild gebündelt. esbuild ist eine Dev-Dependency im Repo-Root: `NodejsFunction` ruft `pnpm exec esbuild` im Verzeichnis der Lockfile auf, also im Root.

- Jede Sorte trägt `seedHash`, einen Hash ihres Seed-Inhalts. Geschrieben wird per `PutItem` mit der Bedingung `attribute_not_exists(PK) OR seedHash <> :seedHash`, also nur fehlende oder im Seed geänderte Sorten.
- Die Custom Resource hat die Eigenschaft `SeedVersion` (Hash über alle Sorten). Nur wenn sich der Seed ändert, läuft sie beim Deploy erneut; ein zweites Deploy ohne Änderung ruft sie gar nicht auf. Feste IDs als Schlüssel verhindern Duplikate.
- Sorten, deren Seed sich nicht geändert hat, bleiben unangetastet, auch wenn ein Admin sie korrigiert hat. Ändert sich der Seed einer Sorte, überschreibt der Seed sie.
- Beim Löschen des Stacks bleiben Tabelle und Daten erhalten.

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/catalog/public/plants` | Globaler Katalog ohne Anmeldung (Gäste), von CloudFront 5 Minuten gecacht |
| GET | `/catalog/plants` | Effektive Sorten des Users (global + Anpassungen + eigene) |
| POST | `/catalog/plants` | Eigene Sorte anlegen |
| PUT | `/catalog/plants/{id}` | Eigene Sorte ändern |
| DELETE | `/catalog/plants/{id}` | Eigene Sorte archivieren |
| PUT | `/catalog/plants/{id}/override` | Anpassung an globaler Sorte speichern |
| DELETE | `/catalog/plants/{id}/override` | Anpassung zurücksetzen |
| POST | `/catalog/plants/{id}/publication` | Publikation anfragen |
| GET | `/catalog/admin/publications` | Offene Anfragen (Admin) |
| POST | `/catalog/admin/publications/{id}/approve` | Freigeben, optional mit Korrekturen (Admin) |
| POST | `/catalog/admin/publications/{id}/reject` | Ablehnen mit Kommentar (Admin) |
| POST/PUT | `/catalog/admin/plants[/{id}]` | Globale Sorten pflegen (Admin) |
| POST | `/catalog/import` | Eigene Sorten und Anpassungen aus dem Gastmodus übernehmen |

### Umsetzung (`services/catalog`)

- **Lambdalith:** Hono-App in `src/app.ts`, Lambda-Einstieg `src/handler.ts`. Alle Routen liegen unter `/api/catalog` (`BASE_PATH`), weil CloudFront den vollen Pfad an die HTTP API weiterreicht.
- **Authentifizierung:** Die HTTP API prüft das Cognito-ID-Token mit einem JWT-Authorizer (Issuer = User Pool, Audience = SPA-Client). Ohne gültiges Token antwortet API Gateway mit 401.
- **User-Kontext:** Eine Middleware liest `sub` und `cognito:groups` aus den geprüften Claims (`requestContext.authorizer.jwt.claims`). Fehlen sie, antwortet auch die App mit 401, außer unter `<BASE_PATH>/public/` (`PUBLIC_PREFIX` in `@hochbeet/service-kit`). Handler dort lesen nie den User.
- **Öffentlicher Katalog** (`GET /catalog/public/plants`, für den Gastmodus):
  - Liefert nur die globalen Sorten als `Plant` (`ListPublicPlantsResponse`), nach Namen sortiert, ohne Anpassungen, eigene Sorten oder sonstige Daten von Usern.
  - Eigene Route in der HTTP API ohne Authorizer (`ServiceApiStack`, Prop `publicGetPaths`), genauer als `{proxy+}` und deshalb vorrangig. Alle anderen Pfade, auch weitere unter `/public/`, bleiben hinter dem JWT-Authorizer. Die Route hat ein eigenes, niedrigeres Throttling (5 Requests/s, Burst 10).
  - Die App setzt `Cache-Control: public, max-age=300`. CloudFront cacht `/api/catalog/public/*` mit einer eigenen Cache-Policy (TTL höchstens 5 Minuten) ohne Header, Cookies oder Query-Strings im Cache-Key; alle Gäste teilen sich also eine Kopie, und die Lambda läuft höchstens alle paar Minuten je Edge-Standort. Neu freigegebene Sorten erscheinen bei Gästen deshalb mit bis zu 5 Minuten Verzögerung.
- **Logging:** Pro Request schreibt die App eine JSON-Logzeile mit `requestId`, `userId`, Methode, Pfad, Status und Dauer.
- **Fehler:** Antworten haben immer die Form `ErrorResponse` mit deutscher `message`. Interne Fehler werden geloggt und nach außen nur allgemein gemeldet.
- **Effektive Sicht** (`src/catalog/effective.ts`) für `GET /catalog/plants`:
  - Globale Sorten mit Anpassung (`{...global, ...override}`) und dazu die eigenen, nicht archivierten Sorten, sortiert nach Namen.
  - Die Kennzeichnung aus dem Issue (`isOverridden`, `isCustom`) liefert der bestehende Contract `CatalogPlantSchema` als `overridden` und `source: 'GLOBAL' | 'OWN'`.
  - Angepasste globale Sorten tragen zusätzlich `global` mit den unveränderten globalen Feldern (seit T-31). So markiert die App jedes geänderte Feld mit seinem Standardwert und berechnet die nächste Anpassung genau gegen den globalen Stand.
  - Globale Sorten cacht jede Lambda-Instanz 5 Minuten.
- **Item-Formate unter `USER#<uid>`:**
  - Anpassung: `SK = OVERRIDE#<plantId>` mit `plantId` und `fields` (die geänderten Felder).
  - Eigene Sorte: `SK = PLANT#<id>` mit den Sortenfeldern sowie `publicationStatus` (Standard `PRIVATE`), optional `rejectionComment` und `archived`.
- **Eigene Sorten** (`POST /catalog/plants`, `PUT` und `DELETE /catalog/plants/{id}`):
  - Neue Sorten bekommen eine ULID und den Status `PRIVATE`.
  - `PUT` ersetzt die Felder und lässt den Publikationsstatus unverändert. Weggelassene optionale Felder (z. B. `sowing`) werden dabei entfernt, nicht mit den alten Werten gemischt.
  - `DELETE` archiviert immer (`archived`, `archivedAt`), statt hart zu löschen: Der Catalog-Service weiß nicht, ob Pflanzungen die Sorte nutzen, weil die Services sich nie gegenseitig aufrufen. Archivierte Sorten verschwinden aus der Liste und lassen sich nicht mehr ändern; erneutes Archivieren ist erlaubt.
  - Fremde und unbekannte IDs liefern 404.
- **Anpassungen** (`PUT` und `DELETE /catalog/plants/{id}/override`): nur für globale Sorten. `PUT` speichert die geänderten Felder vollständig neu, `DELETE` setzt die Sorte zurück.
- **Nachbarlisten:**
  - Eigene Sorten dürfen auf globale und eigene, nicht archivierte Sorten des Users verweisen.
  - Anpassungen globaler Sorten dürfen nur auf globale Sorten verweisen. Das ist die Regel „Nachbarlisten globaler Sorten nur auf globale Sorten“ für den persönlichen Overlay. Es geht dabei nichts verloren: Weil Nachbarn symmetrisch ausgewertet werden, trägt der User die Beziehung zu einer eigenen Sorte einfach an der eigenen Sorte ein.
  - Eine Sorte ist nie ihr eigener Nachbar. Verstöße liefern 400 mit `issues` je Listeneintrag.
- **Publikation** (`POST /catalog/plants/{id}/publication`):
  - Setzt eine eigene Sorte auf `PENDING`. Sie bekommt `requestedAt` und die GSI1-Schlüssel (`GSI1PK = PUBLICATION#PENDING`, `GSI1SK = <Zeitstempel>#<id>`).
  - Erneutes Anfragen während `PENDING` ändert nichts. Für veröffentlichte Sorten gibt es 409.
  - Nachbarn müssen global sein, sonst 400. Ein alter Ablehnungskommentar wird entfernt.
  - Archivieren nimmt die Sorte aus der Warteschlange.
- **Admin** (`/catalog/admin/*`, nur Gruppe `admins`, sonst 403):
  - `GET publications` liefert die Warteschlange über `GSI1`, älteste zuerst.
  - `approve` schreibt in einer Transaktion die globale Sorte mit derselben ID (plus Korrekturen) und setzt die eigene Sorte auf `PUBLISHED` (bedingt auf `PENDING`, sonst 409). Pflanzungen, die die ID verwenden, funktionieren ohne Migration weiter.
  - `reject` setzt die Sorte zurück auf `PRIVATE` mit `rejectionComment`.
  - `POST /admin/plants` legt globale Sorten mit neuer ULID an, `PUT /admin/plants/{id}` ersetzt sie und behält `seedHash`. Ändert sich der Seed dieser Sorte später, gewinnt also weiterhin der Seed.
  - Globale Nachbarlisten dürfen nur auf globale Sorten zeigen.
- **Nach der Freigabe:**
  - Veröffentlichte eigene Sorten erscheinen in der Liste nur noch einmal, als globale Sorte.
  - Ändert der ursprüngliche User sie mit `PUT /catalog/plants/{id}`, werden die vom globalen Stand abweichenden Felder als persönliche Anpassung gespeichert. Gibt es keine Abweichung, wird die Anpassung zurückgesetzt.
- **Tests:**
  - Unit-Tests für Logik und App.
  - Integrationstest (`*.integration.test.ts`) gegen DynamoDB Local (`amazon/dynamodb-local:3.1.0`) über Testcontainers. Er braucht ein laufendes Docker.

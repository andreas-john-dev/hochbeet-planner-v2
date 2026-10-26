# Garden-Service

Teil der [Architektur](../architecture.md). Beete und Pflanzungen der User sowie die Übernahme aus dem Gastmodus.

| PK | SK | Inhalt |
| --- | --- | --- |
| `USER#<uid>` | `BED#<bedId>` | Beet |
| `USER#<uid>` | `BED#<bedId>#PLANTING#<id>` | Pflanzung |
| `USER#<uid>` | `IMPORT#<importId>` | Stand eines Imports aus dem Gastmodus (ID-Zuordnung, Antwort) |
| `USER#<uid>` | `SETTINGS` | Einstellungen für alle Beete, z. B. letzter Frost (`GardenSettingsSchema`) |

Eine Query mit `begins_with BED#<bedId>` lädt ein Beet samt allen Pflanzungen über alle Zeiträume. Die Mandantentrennung ist damit Teil des Schlüssels.

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/garden/beds` | Alle Beete des Users |
| POST | `/garden/beds` | Beet anlegen |
| GET | `/garden/beds/{bedId}` | Beet mit allen Pflanzungen |
| PUT | `/garden/beds/{bedId}` | Beet ändern (Name, Maße, Reihenrichtung, Erneuerungsdaten) |
| DELETE | `/garden/beds/{bedId}` | Beet mit Pflanzungen löschen |
| POST | `/garden/beds/{bedId}/plantings` | Pflanzung anlegen |
| PUT | `/garden/beds/{bedId}/plantings/{id}` | Pflanzung ändern (verschieben, Daten, Entfernen) |
| DELETE | `/garden/beds/{bedId}/plantings/{id}` | Pflanzung löschen |
| POST | `/garden/import` | Beete und Pflanzungen aus dem Gastmodus übernehmen |
| GET | `/garden/settings` | Einstellungen des Users, ohne Eintrag die Standardwerte |
| PUT | `/garden/settings` | Einstellungen ersetzen |

Verkleinert ein User sein Beet, bleiben Pflanzungen außerhalb erhalten und erzeugen den Hinweis „Beetrand“.

## Umsetzung (`services/garden`)

- **Muster:** Der Service folgt dem Catalog-Service. Routen liegen unter `/api/garden`, Middleware, Logging und Fehlerformat kommen aus `@hochbeet/service-kit` (siehe [Backend](./backend.md)).
- **Beete:**
  - `GET /garden/beds` liefert die Beete des Users, sortiert nach Namen.
  - `POST` legt ein Beet mit neuer ULID an.
  - `GET /garden/beds/{bedId}` liefert Beet und Pflanzungen aus einer Query.
  - `PUT` ersetzt die Felder, inklusive Reihenrichtung und Erneuerungsdaten.
  - `DELETE` löscht erst alle Pflanzungen des Beets, dann das Beet. So lässt sich ein unterbrochener Löschvorgang einfach wiederholen. Gelöscht wird mit einzelnen `DeleteItem`-Aufrufen, jeweils 25 parallel; dafür braucht die Lambda kein `BatchWriteItem`.
- **Pflanzungen:**
  - `POST /garden/beds/{bedId}/plantings` legt eine Pflanzung mit neuer ULID an. Das Beet muss existieren und dem User gehören, sonst 404.
  - `PUT /garden/beds/{bedId}/plantings/{id}` ersetzt eine bestehende Pflanzung, zum Beispiel beim Verschieben oder Entfernen ab einer Woche.
  - `DELETE /garden/beds/{bedId}/plantings/{id}` löscht sie.
  - Die API prüft nur die Struktur über `SavePlantingRequestSchema`: Raster-Vielfache von 5, Reihen mit Orientierung und Länge, Start vor Ende, Start und Entfernen jeweils am Montag.
  - `origin` (Direktsaat oder gepflanzt) fehlt in Einträgen von vor T-51: Das Schema liest sie als `TRANSPLANT`, eine Datenmigration in DynamoDB gibt es nicht; jedes Speichern schreibt das Feld mit. Requests ohne `origin` bekommen ebenfalls `TRANSPLANT`.
  - Fachliche Befunde wie „Beetrand“ berechnet der Client. Sie blockieren das Speichern nie, auch eine Pflanzung außerhalb des Beets wird gespeichert.
  - Ob die Sorte existiert, prüft der Garden-Service nicht, weil Services sich nie gegenseitig aufrufen.
- **Einstellungen** (T-53): `lastFrost` als Monat und Tag (`MM-DD`, gilt jedes Jahr; der 29. Februar wird abgelehnt, weil es ihn nicht jedes Jahr gibt). `GET` liefert ohne Eintrag `DEFAULT_GARDEN_SETTINGS` (letzter Frost `05-15`), `PUT` ersetzt den Eintrag. Das Datum eines Jahres berechnet `lastFrostDate(settings, year)` in `packages/garden-rules/src/time.ts`. Gäste haben kein Profil; die lokale API liefert ihnen die Standardwerte (`settings` im Gastspeicher ist optional, die Version bleibt).
- **Import aus dem Gastmodus** (`POST /garden/import`, `src/garden/import.ts`): siehe „Übernahme aus dem Gastmodus“.
- **Mandantentrennung:** Fremde und unbekannte Beete liefern 404. Weil der User Teil jedes Schlüssels ist, kann eine Query nie fremde Beete treffen.
- **Tests:** Integrationstests gegen DynamoDB Local; die Hilfsfunktionen dafür stellt `@hochbeet/service-kit/testing` bereit.

## Übernahme aus dem Gastmodus

Meldet sich ein Gast an oder registriert sich, fragt die App nach der Übernahme seiner Daten aus dem Browser (T-39). Weil Services sich nie gegenseitig aufrufen, gibt es zwei Endpunkte, und der Client verbindet sie:

1. `POST /catalog/import` mit eigenen Sorten (auch archivierten, weil Pflanzungen sie nutzen können) und Anpassungen. Eigene Sorten bekommen neue ULIDs und sind privat; Nachbarn zeigen auf die neuen IDs importierter Sorten oder auf globale Sorten, unbekannte fallen weg. Anpassungen gelten nur für globale Sorten und nur mit globalen Nachbarn; hat der User für eine Sorte schon eine Anpassung, bleibt seine (`PutItem` mit `attribute_not_exists`). Die Antwort ordnet alte Sorten-IDs den neuen zu.
2. Der Client setzt diese IDs in die Pflanzungen ein und ruft `POST /garden/import` mit Beeten und Pflanzungen auf. Beete und Pflanzungen bekommen neue ULIDs, Pflanzungen zeigen auf die neuen Beete; eine Pflanzung eines Beets, das nicht im Import ist, ergibt 400.

- **Idempotenz:** Beide Requests tragen dieselbe `importId` (ULID aus dem Client, im `localStorage` unter `hochbeet-guest-import-id`, bis der Import gelungen ist). Jeder Service speichert unter `IMPORT#<importId>` zuerst die ID-Zuordnung, schreibt dann die Daten mit genau diesen IDs und zuletzt die Antwort. Ein wiederholter Request liefert die gespeicherte Antwort; ein unterbrochener Import wird mit denselben IDs zu Ende geschrieben. So entstehen nie Duplikate.
- **Grenzen:** höchstens 50 Beete, 1000 Pflanzungen, 200 eigene Sorten und 200 Anpassungen je Import, mit deutscher Meldung; das reicht weit für alles, was ein Gast im Browser plant, und hält einen Request klein.
- **Schreiben:** einzelne `PutItem`-Aufrufe, 25 parallel; die IAM-Policies der Lambdas bleiben unverändert.
- **Frontend:** `GuestImportDialog` (im `AppShell`, nur angemeldet) liest die Gastdaten (`createGuestRepository()`), nennt, was in diesem Browser liegt, und bietet „Übernehmen“ bzw. „Lokale Beete hinzufügen“, wenn das Konto schon Beete hat, dazu „Verwerfen“ und „Später“. Nach Erfolg löscht es die Gastdaten und lädt alle Abfragen neu; bei Fehlern bleiben die Daten, und die Meldung kommt über `apiErrorMessage()`. Die Logik liegt in `src/lib/guest-import.ts`, die Mock-API bildet beide Endpunkte nach.

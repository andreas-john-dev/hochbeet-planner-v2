# Domänenmodell und Zeitmodell

Teil der [Architektur](../architecture.md). Beet, Pflanzung, Sorte, Standfläche, Wochen und Saisongrenze.

## Domänenmodell

Das Modell kennt drei Kernobjekte: das Beet, die Pflanzung und die Sorte. Alle Längen sind in Zentimetern angegeben. Positionen liegen auf einem 5-cm-Raster, dessen Ursprung die linke obere Ecke des Beets ist.

### Bed (Hochbeet)

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id` | ULID | Eindeutige ID |
| `name` | string | Anzeigename |
| `widthCm` | number | Breite des Beets |
| `depthCm` | number | Tiefe des Beets |
| `mainRowDirection` | `H` \| `V` | Reihenrichtung des Beets, pro Beet wählbar; Standard parallel zur kürzeren Kante, also Reihen quer übers Beet (z. B. 1 m lang in einem 2 × 1 m Beet) |
| `soilRenewals` | Datum[] | Zeitpunkte „Erde erneuert“; setzen die Fruchtfolge zurück (Standard: jährlich 1. März) |

### Planting (Pflanzung)

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id` | ULID | Eindeutige ID |
| `bedId` | ULID | Zugehöriges Beet |
| `plantId` | ULID | Verweis auf die Sorte |
| `origin` | `DIRECT_SOW` \| `TRANSPLANT` | Direkt gesät oder als Jungpflanze gesetzt; neu vorbelegt mit `DIRECT_SOW` für Sorten mit `sowing.method: 'DIRECT'`, sonst `TRANSPLANT`; fehlt in älteren Daten und gilt dann als `TRANSPLANT` |
| `kind` | `SINGLE` \| `ROW` | Einzelpflanze oder Reihe |
| `x`, `y` | number | Position in cm, Vielfaches von 5; bei Reihen der Startpunkt |
| `orientation` | `H` \| `V` | Nur Reihen: parallel zur Breite oder zur Tiefe; vorbelegt mit der Reihenrichtung des Beets |
| `lengthCm` | number | Nur Reihen: Länge in 5er-Schritten |
| `startDate` | ISO-Datum | Pflanz- bzw. Saatdatum, immer der Montag der gewählten Woche |
| `endDate` | ISO-Datum \| null | Aus dem Lebenszyklus vorbelegt (bei Direktsaat mit Zuschlag), pro Pflanzung überschreibbar; leer bei Dauerkulturen |
| `removedDate` | ISO-Datum \| null | Manuelles Entfernen „ab KW XY“; sticht `endDate` |

Die Stückzahl einer Reihe wird nicht gespeichert, sondern berechnet: `floor(lengthCm / Pflanzabstand) + 1`.

`origin` hat im Schema den Standardwert `TRANSPLANT`: Der Garden-Service liest alte Einträge ohne das Feld ohne Datenmigration in DynamoDB und schreibt es bei jedem Speichern; Requests und Gast-Importe ohne `origin` (ältere App-Stände) bleiben gültig. Der Gastspeicher setzt es beim Wechsel auf Version 2 (`src/lib/local-api/store.ts`). Im Editor schaltet das Bearbeiten-Panel zwischen „Direktsaat“ und „Gepflanzt“ um; ein vorbelegtes Ende (gleich dem Ende aus dem Lebenszyklus) wandert dabei mit, ein von Hand gesetztes bleibt.

### Plant (Sorte)

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id` | ULID | Bleibt auch bei Publikation gleich |
| `name` | string | z. B. „Kopfsalat“ |
| `category` | `GEMUESE` \| `OBST` \| `KRAUT` | Kategorie |
| `family` | string | Pflanzenfamilie, z. B. Kreuzblütler; Basis der Fruchtfolge |
| `feeder` | `STARK` \| `MITTEL` \| `SCHWACH` | Nährstoffbedarf |
| `spacingInRowCm` | number | Pflanzabstand in der Reihe |
| `rowSpacingCm` | number | Reihenabstand |
| `lifecycle` | Union, siehe unten | Wie lange die Pflanze im Beet bleibt |
| `goodNeighbors` | plantId[] | Gute Nachbarn (symmetrisch ausgewertet) |
| `badNeighbors` | plantId[] | Schlechte Nachbarn (symmetrisch ausgewertet) |
| `color` | string | Farbe der Standfläche im Beet-Editor |
| `icon` | string | Schlüssel eines SVG-Icons aus `packages/plant-icons`; eigene Sorten wählen ein vorhandenes Icon oder bekommen das Kategorie-Icon |
| `frostSensitive` | boolean, optional | Frostempfindlich: kommt erst nach dem letzten Frost ins Freie; fehlt = `false` |
| `sowing` | Objekt, optional | Aussaat und Anzucht, siehe unten; fehlt bei Sorten ohne Angaben |

Der Lebenszyklus hat drei Varianten:

- `ANNUAL` mit `cultureWeeks`: Ende = Pflanzdatum + Kulturdauer.
- `MULTI_YEAR` mit `years`: Ende = Pflanzdatum + Jahre, z. B. Erdbeere mit 3 Jahren.
- `PERENNIAL`: kein Ende, z. B. Rosmarin; nur manuelles Entfernen.

Die Standzeit zählt ab dem Tag, an dem die Pflanze ins Beet kommt, also ab dem Auspflanzen oder der Direktsaat (Epic #120).

### Aussaat und Anzucht (`sowing`)

Angaben wie auf der Rückseite einer Samentüte. Zeitfenster sind wiederkehrende ISO-Kalenderwochen von–bis (`WeekWindow`, beide Enden eingeschlossen); `from > to` geht über den Jahreswechsel, z. B. KW 40 bis 8. `isWeekInWindow()` in `packages/contracts` prüft, ob eine Woche im Fenster liegt.

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `method` | `DIRECT` \| `PRESOW` \| `BOTH` | Direktsaat ins Beet, Vorkultur als Jungpflanze oder beides |
| `presowWeeks` | WeekWindow | Wann vorgezogen werden kann; Pflicht bei `PRESOW` und `BOTH` |
| `propagationWeeks` | `{ min, max }` Wochen | Von der Aussaat bis zum Auspflanzen; Pflicht bei `PRESOW` und `BOTH` |
| `prickOutWeeks` | Wochen, optional | Pikieren nach so vielen Wochen; nur mit Vorkultur |
| `directSowWeeks` | WeekWindow | Wann direkt ins Beet gesät werden kann; Pflicht bei `DIRECT` und `BOTH` |
| `directSowExtraWeeks` | Wochen, optional | Kommt bei Direktsaat zur Standzeit dazu (Keimen, erste Wochen); fehlt = 0; nur mit Direktsaat |
| `germinationDays` | `{ min, max }` Tage, optional | Keimdauer |
| `germinationTempC` | `{ min, max }` °C, optional | Keimtemperatur |

Angaben, die nicht zur Methode passen (z. B. `prickOutWeeks` bei reiner Direktsaat), lehnt das Schema ab; Bereiche brauchen `min ≤ max`. Eine persönliche Anpassung ersetzt den Block `sowing` als Ganzes; Angaben einer globalen Sorte lassen sich anpassen, aber nicht per Anpassung entfernen.

### Standfläche

Jede Pflanzung hat eine Standfläche, die alle Regeln einheitlich macht und im Editor halbtransparent gezeigt wird.

- Einzelpflanze: Kreis um `(x, y)` mit Radius `spacingInRowCm / 2`.
- Reihe: Streifen entlang der Reihe mit Breite `rowSpacingCm`, an den Enden je `spacingInRowCm / 2` überstehend.

Die **Lücke** zwischen zwei Pflanzungen ist der kürzeste Abstand zwischen ihren Standflächen. Überlappen sie, ist die Lücke negativ; ihr Betrag ist die Eindringtiefe. Berühren sie sich nur, ist die Lücke 0.

Umsetzung in `packages/garden-rules` (`geometry.ts`):

- Der Streifen einer Reihe ist ein achsenparalleles Rechteck. Bei `orientation: H` reicht er von `x − Abstand/2` bis `x + lengthCm + Abstand/2` und quer dazu `y ± rowSpacingCm/2`, bei `V` mit vertauschten Achsen.
- Eine Standfläche belegt eine **Rasterzelle**, wenn sich ihre Flächen überschneiden; bloßes Berühren zählt nicht. Zelle `(col, row)` umfasst `[5·col, 5·col + 5) × [5·row, 5·row + 5)`. Eine Einzelpflanze auf einem Rasterpunkt belegt damit immer mindestens vier Zellen.
- Abstände (`spacingInRowCm`, `rowSpacingCm`) sind ganze Zentimeter, aber nicht an das 5-cm-Raster gebunden, weil die Quellen Werte wie 7 cm nennen. Das Raster gilt nur für Positionen, Längen und Beetmaße.
- Standard-Reihenrichtung eines neuen Beets: `V`, wenn das Beet mindestens so breit wie tief ist, sonst `H`.

## Zeitmodell

Geplant wird in Wochen, angezeigt werden aber echte Daten: Im UI steht „30. März – 5. April 2026“ im Vordergrund, die KW nur klein daneben. Intern werden ISO-Datumswerte gespeichert, Wochen folgen ISO-8601 (Montag bis Sonntag), gerechnet wird mit date-fns.

- **Wochen-Slider** über jedem Beet, beschriftet mit Monatsnamen. Er zeigt, was in der gewählten Woche im Beet steht. Vorgänger und Nachfolger an derselben Stelle erscheinen als blasse „Geister“.
- **Einjährige Sorten** enden nach Pflanzdatum plus Kulturdauer, bei Direktsaat plus `directSowExtraWeeks` der Sorte; das Ende ist pro Pflanzung anpassbar.
- **Erdbeeren** (`MULTI_YEAR`, 3 Jahre) bleiben automatisch drei Jahre im Beet, außer sie werden vorher entfernt.
- **Dauerkulturen** wie Rosmarin bleiben unbegrenzt, bis man „Entfernen ab …“ wählt.
- **Entfernen** setzt `removedDate` auf den Montag der gewählten Woche. Die Pflanzung bleibt in der Historie sichtbar und zählt für die Fruchtfolge.

Umsetzung in `packages/garden-rules` (`time.ts`):

- **Zeitraum einer Pflanzung:** halboffen `[Start, Ende)`. Das Ende ist der erste Tag, an dem die Pflanzung nicht mehr im Beet steht; endet eine Pflanzung am Montag, an dem die nächste beginnt, überlappen sie nicht. Kein Ende heißt unbegrenzt.
- **Effektives Ende:** `removedDate` vor `endDate` vor dem Lebenszyklus (`plannedEnd()`; `ANNUAL`: Start + Kulturwochen, bei `origin: 'DIRECT_SOW'` plus `sowing.directSowExtraWeeks`; `MULTI_YEAR`: Start + Jahre; `PERENNIAL`: kein Ende). `removedDate` gewinnt auch, wenn es nach dem geplanten Ende liegt.
- **Vorbelegung neuer Pflanzungen:** `defaultOrigin()` (Direktsaat nur bei `method: 'DIRECT'`) und `endDate = plannedEnd()`; gilt für Pflanzungen aus der Palette (`newPlanting()`) und für Vorschläge des Assistenten (`candidatePlanting()`).
- **Woche:** ISO-8601, Montag bis Sonntag. Eine Pflanzung ist in einer Woche sichtbar, wenn sie an mindestens einem Tag der Woche im Beet steht.
- **Anzeige:** `formatWeek()` liefert „30. März – 5. April 2026 · KW 14“; Frontend und Regeln nutzen dieselbe Funktion.

### Saisongrenze

Die Fruchtfolge gilt nur innerhalb einer Saison, weil jedes Jahr neue Erde aufgefüllt wird. Jedes Beet hat Ereignisse „Erde erneuert am …“, und eine Fruchtfolge-Warnung entsteht nur, wenn zwischen dem Ende des Vorgängers und dem Start des Nachfolgers keine Erneuerung liegt.

- Ohne eigenen Eintrag gilt jedes Jahr der 1. März als Erneuerung. Das gilt **pro Jahr**: Hat ein Beet für ein Jahr eigene Daten, ersetzen sie dort den 1. März; alle anderen Jahre behalten den Standard.
- Eine Erneuerung zählt, wenn sie zwischen dem Ende des Vorgängers und dem Start des Nachfolgers liegt, beide Tage eingeschlossen.
- Der User kann das Datum pro Beet setzen oder verschieben, etwa wenn Knoblauch über den Winter steht.
- Dauerkulturen und Erdbeeren stehen über eine Erneuerung hinweg einfach weiter.

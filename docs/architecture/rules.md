# Regel-Engine

Teil der [Architektur](../architecture.md). Die Fachregeln in `packages/garden-rules` (Abstand, Nachbarn, Starkzehrer, Fruchtfolge, Beetrand, Frost, Anzucht) und ihre Schnittstelle.

Alle Warnungen werden von einer reinen TypeScript-Bibliothek `packages/garden-rules` berechnet und nie gespeichert. Warnungen blockieren das Speichern nie. Sie veralten deshalb auch nicht, wenn eine Sorte angepasst wird.

Alle Regeln für Paare außer der Fruchtfolge gelten nur zwischen Pflanzungen, deren Zeiträume sich überlappen. Der Einflussradius für Nachbarschaft und Starkzehrer beträgt 30 cm und ist als Konstante zentral konfigurierbar.

| Regel | Bedingung | Stufe | Einfache Ansicht |
| --- | --- | --- | --- |
| Pflanzabstand | Standflächen zweier Pflanzungen überlappen (Lücke < 0) | Warnung | ja |
| Schlechte Nachbarn | Eine Sorte steht in `badNeighbors` der anderen und die Lücke ist < 30 cm | Warnung | ja |
| Gute Nachbarn | Eine Sorte steht in `goodNeighbors` der anderen, keine Seite markiert das Paar als schlecht, und die Lücke ist < 30 cm | Positiver Hinweis | ja |
| Starkzehrer | Beide sind `STARK`, stehen quer zur Reihenrichtung nebeneinander und die Lücke ist < 30 cm; hintereinander in Reihenrichtung nie | Warnung | ja |
| Fruchtfolge | Auf mindestens einer Rasterzelle gehört der direkte Vorgänger zur selben Familie, und dazwischen wurde die Erde nicht erneuert | Warnung | nein |
| Beetrand | Standfläche ragt über den Beetrand | Dezenter Hinweis | ja |
| Frost | Sorte ist `frostSensitive` und kommt am oder vor dem letzten Frosttermin desselben Jahres ins Beet (Direktsaat wie Pflanzung) | Dezenter Hinweis | nein |
| Zu früh ausgepflanzt | Pflanzung aus einer Charge: `startDate` < Aussaatwoche + `propagationWeeks.min` | Warnung | nein |
| Zu lange in der Anzucht | Pflanzung aus einer Charge: `startDate` > Aussaatwoche + `propagationWeeks.max` + 2 Wochen | Dezenter Hinweis | nein |
| Mehr verplant als vorhanden | Verplant (alle Beete) > Bestand einer nicht abgeschlossenen Charge (`batchStock()`: vor der Keimung `sownCount`, danach `aliveCount`) | Warnung an allen verknüpften Pflanzungen des Beets | nein |

In der einfachen Ansicht (`scope: 'SIMPLE'`, T-74) gelten nur die räumlichen Regeln einer Woche. Fruchtfolge, Frost und Anzucht hängen von der Historie, vom Datum oder von den Chargen ab und fallen weg.

Befunde an Chargen (`evaluateSowings()`, Anzucht-Seite):

| Befund | Bedingung | Stufe |
| --- | --- | --- |
| Aussaat außerhalb des Vorkulturfensters | Aussaatwoche liegt nicht in `presowWeeks` | Dezenter Hinweis |
| Vorziehen einer Direktsaat-Sorte | `sowing.method` ist `DIRECT` („verträgt Umpflanzen schlecht“) | Dezenter Hinweis |
| Mehr verplant als vorhanden | wie oben | Warnung |
| Auspflanzen vor dem Frost | Sorte ist `frostSensitive` und `plannedTransplantDate` liegt am oder vor dem letzten Frost desselben Jahres | Dezenter Hinweis |

## Details

**Warnung sticht:** Markiert eine Seite ein Paar als schlechten Nachbarn, gilt es als schlecht, auch wenn die andere Seite es als guten Nachbarn führt. Solche Widersprüche kommen in den Quellen des Startkatalogs vor.

**Starkzehrer** werden nur quer zur Reihenrichtung geprüft. Drei Brokkoli hintereinander in einer Reihe sind erlaubt. Daneben darf aber kein weiterer Starkzehrer stehen, etwa Brokkoli oder Staudensellerie in der Nachbarreihe, solange weniger als 30 cm Lücke bleiben.

- Innerhalb einer Reihen-Pflanzung entsteht nie eine Warnung.
- Zwei Pflanzungen stehen **nebeneinander**, wenn sich ihre Standflächen entlang der Reihenrichtung überschneiden und quer dazu weniger als 30 cm Lücke liegt.
- Eine Pflanzung in Verlängerung einer Reihe, also am Kopfende, steht **hintereinander** und ist erlaubt.
- Reihenrichtung: bei Reihen ihre Orientierung, bei Einzelpflanzen die Reihenrichtung des Beets (`mainRowDirection`).
- Haben zwei Reihen unterschiedliche Orientierung, wird aus Sicht beider Reihen geprüft; eine Warnung entsteht, wenn sie aus einer Sicht nebeneinander stehen.
- Umsetzung (`rules/heavy-feeders.ts`): Aus Sicht einer Reihenrichtung stehen zwei Starkzehrer **nebeneinander**, wenn sich ihre Standflächen entlang der Reihe mit mehr als 0 cm überschneiden und quer dazu eine Lücke von mindestens 0 und unter 30 cm liegt. Überschneiden sie sich auf beiden Achsen, warnt nur die Abstandsregel; so lösen zu eng gesetzte Pflanzen derselben Reihe keine Starkzehrer-Warnung aus. Der Text nennt die kleinste gefundene Lücke.

**Fruchtfolge** wird pro 5-cm-Rasterzelle geprüft. Für jede Zelle der neuen Pflanzung wird die zuletzt dort beendete Pflanzung derselben Saison gesucht. Gehört sie zur selben Pflanzenfamilie, entsteht eine Warnung. Eine dazwischenliegende Pflanzung einer anderen Familie hebt die Warnung auf, weil dann kein direkter Nachfolger mehr vorliegt.

Umsetzung (`rules/crop-rotation.ts`): Direkter Vorgänger auf einer Zelle ist die Pflanzung, die dort zuletzt geendet hat, spätestens am Starttag der neuen; gleichzeitig stehende Pflanzungen und Dauerkulturen ohne Ende zählen nicht. Familien werden ohne Rücksicht auf Groß- und Kleinschreibung verglichen. Pro Paar aus Vorgänger und Nachfolger entsteht ein Befund mit dem Zeitraum des Nachfolgers. Weil auf Zellen gerechnet wird, reicht es, wenn beide Standflächen in dieselbe 5-cm-Zelle reichen, auch wenn sie sich nur berühren.

## Befunde und Regeln im Code

Jede Regel ist eine Funktion `(ctx: RuleContext) => Finding[]` in `packages/garden-rules/src/rules/`. `resolvePlantings()` verbindet vorher jede Pflanzung einmal mit ihrer Sorte, Standfläche und ihrem Zeitraum; Pflanzungen mit unbekannter Sorte werden übersprungen.

Ein `Finding` hat `rule`, `severity` (`WARNING`, `POSITIVE` oder `HINT`), sortierte `plantingIds`, den Zeitraum `period`, die Werte hinter dem Text `params` und den fertigen Text `message` in der Sprache von `locale`. Bei Paaren ist `period` die gemeinsame Zeit beider Pflanzungen, beim Beetrand die Standzeit der Pflanzung. Geometrische Vergleiche nutzen eine Toleranz von 10⁻⁶ cm, damit sich nur berührende Standflächen nicht als überlappend gelten. In Texten zu Paaren stehen die Sortennamen alphabetisch in der Sprache des Textes („Kartoffel und Tomate“), damit der Befund nicht von der Reihenfolge der Pflanzungen abhängt; `params.plants` hat dieselbe Reihenfolge.

Der Einflussradius (`INFLUENCE_RADIUS_CM = 30` in `constants.ts`) gilt, solange die Lücke **kleiner** als 30 cm ist; bei genau 30 cm greift die Regel nicht mehr. Gute und schlechte Nachbarn werden symmetrisch ausgewertet: Es genügt, wenn eine der beiden Sorten die andere listet.

**Frost** (`rules/frost.ts`, T-54): Maßgeblich ist nur der Start der Pflanzung (`startDate`) gegenüber dem Frosttermin seines Jahres (`lastFrostDate()`); der Frosttag selbst zählt noch als zu früh, passend zum Aussaatkalender („erst nach dem 15. Mai ins Freie“). Eine Pflanzung, die nach dem Frost beginnt und über den Winter steht, bekommt keinen Hinweis. Pro Pflanzung entsteht ein Befund mit ihrer Standzeit als Zeitraum, Text z. B. „Tomate ist frostempfindlich und sollte erst nach dem 15. Mai ins Beet.“

**Anzucht** (`rules/sowing.ts`, T-59): Die Regeln an Pflanzungen gelten nur für Pflanzungen mit `sowingId` einer bekannten Charge; eine gelöschte Charge (die `sowingId` bleibt stehen) oder eine ohne passende Charge erzeugt nichts. Die Anzuchtdauer ist die Zahl ganzer Wochen von der Aussaatwoche bis zum Start der Pflanzung (beides Montage) und wird mit `propagationWeeks` der effektiven Sorte der Pflanzung verglichen: Genau die kürzeste Dauer ist noch in Ordnung, ebenso genau die längste plus zwei Wochen (`LATE_TRANSPLANT_GRACE_WEEKS`). „Verplant“ zählt die Pflanzen aller verknüpften Pflanzungen aus allen Beeten (`plannedCount()`); verplant gleich Bestand ist in Ordnung. Als Bestand zählt vor der Keimung (`PLANNED`, `SOWN`) die geplante bzw. gesäte Menge, danach die lebenden Jungpflanzen (`batchStock()`); so warnt eine geplante Charge aus dem Anzuchtplan (T-60) nicht, solange ihre Saatmenge reicht. Abgeschlossene Chargen (`DONE`, Bestand 0 nach „Abschließen“) gelten als aufgebraucht und lösen keine Warnung aus, ebenso wenig Befunde an der Charge. Die Warnung „mehr verplant“ ist ein Befund pro Charge und Beet mit allen verknüpften Pflanzungen dieses Beets; ihr Zeitraum reicht vom frühesten Start bis zum spätesten Ende. Bei einer Direktsaat-Sorte entfällt der Hinweis zum Vorkulturfenster, weil es keins gibt.

## Schnittstelle

Die Engine erhält ein Beet, alle seine Pflanzungen und die effektiven Sorten des Users: `evaluateBed(bed, plantings, plants, { scope?, week?, lastFrost?, sowings?, locale?, plantName?, familyName? })`. `sowings` sind die Chargen des Users mit ihren verknüpften Pflanzungen aus allen Beeten (`GET /garden/sowings`); ohne sie greifen die Anzucht-Regeln nicht. Sie liefert eine Liste von Befunden mit Regel, Stufe, betroffenen Pflanzungs-IDs, Zeitraum, Parametern und einem Anzeigetext in der gewünschten Sprache. Optional kann man auf eine Woche filtern. Die Engine ist isomorph und läuft im Browser wie in Node.

Umsetzung (`packages/garden-rules/src/engine.ts`):

- `evaluateBed` verbindet die Pflanzungen einmal mit ihren Sorten und ruft alle Regeln auf. Die Befunde kommen in fester Reihenfolge: Warnungen, dann dezente Hinweise, dann positive Hinweise; innerhalb davon nach Regel, Pflanzungs-IDs und Zeitraum.
- **Regelliste:** `BED_RULES` führt jede Regel als `{ rule, ids, timeDependent }` mit den Regelcodes ihrer Befunde. `timeDependent` ist Pflicht: Neue Regeln müssen sich entscheiden, ob sie mehr als die Pflanzungen einer Woche brauchen (Historie, Datum, Chargen). Ein Test prüft, dass jeder Code aus `RULE_IDS` zu genau einer Regel gehört. `ruleIdsInScope(scope)` liefert die Codes, die ein Umfang liefern kann.
- **Umfang** (`scope`, T-74): `ALL` (Standard) wertet alle Regeln aus wie bisher. `SIMPLE` (einfache Ansicht, Epic #161) verlangt `week` (im Typ von `EvaluateOptions` und zur Laufzeit) und wertet nur die Regeln ohne `timeDependent` aus: Pflanzabstand, schlechte und gute Nachbarn, Starkzehrer und Beetrand. Dabei zählen nur die Pflanzungen, die in der Woche im Beet stehen; Chargen werden ignoriert. Weil Paare nur über ihre gemeinsame Zeit warnen, liefern die räumlichen Regeln für diese Woche genau dasselbe wie mit `ALL`. Ein Property-Test sichert das zu: Die Befunde mit `SIMPLE` sind die räumlichen Befunde mit `ALL` für dieselbe Woche, also eine Teilmenge.
- `lastFrost` ist der letzte Frost des Users als `MM-DD` (`GardenSettings`, T-53); fehlt er, gilt `DEFAULT_LAST_FROST` (15. Mai). Die Regeln bekommen ihn über `RuleContext.lastFrost`. Der Editor übergibt ihn aus `useGardenSettings()` (Gäste: Standard), das Gateway-Tool `evaluate_bed` liest ihn mit dem Token des Users über `GET /api/garden/settings`, damit Assistent und App dieselben Befunde sehen.
- Die Chargen kommen einmal vorberechnet in den Kontext (`RuleContext.sowings`: Charge und verplante Menge je ID, `sowingInfos()`), damit jede Regel nur nachschlägt.
- **Zweiter Einstieg** `evaluateSowings(sowings, plants, { lastFrost?, locale?, plantName?, familyName? })` liefert `SowingFinding`s (`rule`, `severity`, `sowingId`, `params`, `message`) für die Anzucht-Seite, sortiert nach Stufe, Regel und Charge. **Abweichung von „nur `evaluateBed()`“** (Epic #121): Befunde an Chargen haben kein Beet und keine Pflanzungen, an denen sie hängen könnten; sie in `evaluateBed()` zu packen, hätte die Anzucht-Seite gezwungen, ein Beet zu erfinden, und jedem Beet dieselben Befunde zur Charge gegeben. Beide Einstiege nutzen dieselben Bausteine (`sowingInfos()`, `rules/sowing.ts`), die Regeln bleiben rein und isomorph.
- **Sprache** (T-69): `locale` (`'de' | 'en'`, Standard `de`) wählt die Sprache von `message`. Die Texte stehen je Regel als Funktionen von `params` in `src/messages/{de,en}.ts` (reines TypeScript ohne i18next, Typ `Messages`; `messagesFor(locale)`), ebenso Wochen- und Pluralformen und der Frosttag („15. Mai“, „15 May“). Services und Gateway-Tools übergeben kein `locale` und bekommen weiter deutsche Texte; das Feld `message` bleibt dafür kompatibel.
- **Parameter:** `params` enthält je Regel die Werte des Textes (`FindingParams`, `SowingFindingParams`; z. B. `plants` als Paar, `overlapCm`, `weeks`, `sowWeek`, `planned`, `stock`, `stage`, `lastFrost` als `MM-DD`) und ist in jeder Sprache gleich, damit niemand Werte aus dem Text zurückrechnen muss. `Finding` und `SowingFinding` sind nach `rule` unterschiedene Unions, `params` ist also je Regel typisiert.
- **Sortennamen:** `plantName(plant)` und `familyName(plant)` liefern Name und Familie in den Texten; ohne die Optionen sind das die gespeicherten Werte. Die App übergibt die Anzeigenamen aus `packages/contracts` (`plantName()`/`familyName()`, T-71). Die Fruchtfolge vergleicht immer die gespeicherte `family`, nie den Anzeigenamen.
- **Wochen:** `formatWeek(date, locale?)` liefert auf Deutsch „5. – 11. Oktober 2026 · KW 41“, auf Englisch „5 – 11 October 2026 · Week 41“, auch über den Jahreswechsel („29 December 2025 – 4 January 2026 · Week 1“). `weekHint(week, { locale })` („Anfang März“ / „early March“) und `windowText(window, year?, locale?)` („KW 10–14 (Anfang März bis Anfang April)“ / „weeks 10–14 (early March to early April)“) folgen derselben Option.
- Ein Test prüft, dass jede Regel (`RULE_IDS`, `SOWING_RULE_IDS`) in jeder Sprache einen Text hat; neue Regeln brauchen deshalb Texte in beiden Dateien (der Typ `Messages` erzwingt das schon beim Kompilieren).
- Mit `week` wird trotzdem die ganze Historie ausgewertet (die Fruchtfolge braucht Vorgänger); zurück kommen nur Befunde, deren Zeitraum die ISO-Woche berührt.
- Property-Tests (fast-check) sichern zu: Das Ergebnis hängt nicht von der Reihenfolge der Pflanzungen, Sorten oder Chargen ab (für beide Einstiege), Anzucht-Befunde hängen nur an Pflanzungen bekannter Chargen, Nachbarlisten wirken symmetrisch, Befunde sind wohlgeformt, und der Wochenfilter liefert genau die passende Teilmenge.
- Leistung: 200 Pflanzungen in einem 6 × 3 m Beet über zwei Saisons brauchen im Median etwa 15 ms (Vorgabe: unter 50 ms, auch mit 25 Chargen und jeder zweiten Pflanzung aus einer Charge, mit `locale: 'en'` und für eine Woche mit beiden Werten von `scope`; mit `SIMPLE` sind es wenige Millisekunden, weil nur die Pflanzungen der Woche zählen; `engine.perf.test.ts` misst die CPU-Zeit des Prozesses, damit parallel laufende Test-Suites das Ergebnis nicht verfälschen). Die Fruchtfolge nutzt dafür einen Zellindex mit kleinen ganzzahligen Schlüsseln und prüft Familie und Erneuerung nur einmal pro Paar.

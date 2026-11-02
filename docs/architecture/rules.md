# Regel-Engine

Teil der [Architektur](../architecture.md). Die Fachregeln in `packages/garden-rules` (Abstand, Nachbarn, Starkzehrer, Fruchtfolge, Beetrand, Frost) und ihre Schnittstelle.

Alle Warnungen werden von einer reinen TypeScript-Bibliothek `packages/garden-rules` berechnet und nie gespeichert. Warnungen blockieren das Speichern nie. Sie veralten deshalb auch nicht, wenn eine Sorte angepasst wird.

Alle Regeln für Paare außer der Fruchtfolge gelten nur zwischen Pflanzungen, deren Zeiträume sich überlappen. Der Einflussradius für Nachbarschaft und Starkzehrer beträgt 30 cm und ist als Konstante zentral konfigurierbar.

| Regel | Bedingung | Stufe |
| --- | --- | --- |
| Pflanzabstand | Standflächen zweier Pflanzungen überlappen (Lücke < 0) | Warnung |
| Schlechte Nachbarn | Eine Sorte steht in `badNeighbors` der anderen und die Lücke ist < 30 cm | Warnung |
| Gute Nachbarn | Eine Sorte steht in `goodNeighbors` der anderen, keine Seite markiert das Paar als schlecht, und die Lücke ist < 30 cm | Positiver Hinweis |
| Starkzehrer | Beide sind `STARK`, stehen quer zur Reihenrichtung nebeneinander und die Lücke ist < 30 cm; hintereinander in Reihenrichtung nie | Warnung |
| Fruchtfolge | Auf mindestens einer Rasterzelle gehört der direkte Vorgänger zur selben Familie, und dazwischen wurde die Erde nicht erneuert | Warnung |
| Beetrand | Standfläche ragt über den Beetrand | Dezenter Hinweis |
| Frost | Sorte ist `frostSensitive` und kommt am oder vor dem letzten Frosttermin desselben Jahres ins Beet (Direktsaat wie Pflanzung) | Dezenter Hinweis |
| Zu früh ausgepflanzt | Pflanzung aus einer Charge: `startDate` < Aussaatwoche + `propagationWeeks.min` | Warnung |
| Zu lange in der Anzucht | Pflanzung aus einer Charge: `startDate` > Aussaatwoche + `propagationWeeks.max` + 2 Wochen | Dezenter Hinweis |
| Mehr verplant als vorhanden | Verplant (alle Beete) > Bestand (`aliveCount`) einer nicht abgeschlossenen Charge | Warnung an allen verknüpften Pflanzungen des Beets |

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

Ein `Finding` hat `rule`, `severity` (`WARNING`, `POSITIVE` oder `HINT`), sortierte `plantingIds`, den Zeitraum `period` und einen deutschen Text `message`. Bei Paaren ist `period` die gemeinsame Zeit beider Pflanzungen, beim Beetrand die Standzeit der Pflanzung. Geometrische Vergleiche nutzen eine Toleranz von 10⁻⁶ cm, damit sich nur berührende Standflächen nicht als überlappend gelten. In Texten zu Paaren stehen die Sortennamen alphabetisch („Kartoffel und Tomate“), damit der Befund nicht von der Reihenfolge der Pflanzungen abhängt.

Der Einflussradius (`INFLUENCE_RADIUS_CM = 30` in `constants.ts`) gilt, solange die Lücke **kleiner** als 30 cm ist; bei genau 30 cm greift die Regel nicht mehr. Gute und schlechte Nachbarn werden symmetrisch ausgewertet: Es genügt, wenn eine der beiden Sorten die andere listet.

**Frost** (`rules/frost.ts`, T-54): Maßgeblich ist nur der Start der Pflanzung (`startDate`) gegenüber dem Frosttermin seines Jahres (`lastFrostDate()`); der Frosttag selbst zählt noch als zu früh, passend zum Aussaatkalender („erst nach dem 15. Mai ins Freie“). Eine Pflanzung, die nach dem Frost beginnt und über den Winter steht, bekommt keinen Hinweis. Pro Pflanzung entsteht ein Befund mit ihrer Standzeit als Zeitraum, Text z. B. „Tomate ist frostempfindlich und sollte erst nach dem 15. Mai ins Beet.“

**Anzucht** (`rules/sowing.ts`, T-59): Die Regeln an Pflanzungen gelten nur für Pflanzungen mit `sowingId` einer bekannten Charge; eine gelöschte Charge (die `sowingId` bleibt stehen) oder eine ohne passende Charge erzeugt nichts. Die Anzuchtdauer ist die Zahl ganzer Wochen von der Aussaatwoche bis zum Start der Pflanzung (beides Montage) und wird mit `propagationWeeks` der effektiven Sorte der Pflanzung verglichen: Genau die kürzeste Dauer ist noch in Ordnung, ebenso genau die längste plus zwei Wochen (`LATE_TRANSPLANT_GRACE_WEEKS`). „Verplant“ zählt die Pflanzen aller verknüpften Pflanzungen aus allen Beeten (`plannedCount()`); verplant gleich Bestand ist in Ordnung. Abgeschlossene Chargen (`DONE`, Bestand 0 nach „Abschließen“) gelten als aufgebraucht und lösen keine Warnung aus, ebenso wenig Befunde an der Charge. Die Warnung „mehr verplant“ ist ein Befund pro Charge und Beet mit allen verknüpften Pflanzungen dieses Beets; ihr Zeitraum reicht vom frühesten Start bis zum spätesten Ende. Bei einer Direktsaat-Sorte entfällt der Hinweis zum Vorkulturfenster, weil es keins gibt.

## Schnittstelle

Die Engine erhält ein Beet, alle seine Pflanzungen und die effektiven Sorten des Users: `evaluateBed(bed, plantings, plants, { week?, lastFrost?, sowings? })`. `sowings` sind die Chargen des Users mit ihren verknüpften Pflanzungen aus allen Beeten (`GET /garden/sowings`); ohne sie greifen die Anzucht-Regeln nicht. Sie liefert eine Liste von Befunden mit Regel, Stufe, betroffenen Pflanzungs-IDs, Zeitraum und einem deutschen Anzeigetext. Optional kann man auf eine Woche filtern. Die Engine ist isomorph und läuft im Browser wie in Node.

Umsetzung (`packages/garden-rules/src/engine.ts`):

- `evaluateBed` verbindet die Pflanzungen einmal mit ihren Sorten und ruft alle Regeln auf. Die Befunde kommen in fester Reihenfolge: Warnungen, dann dezente Hinweise, dann positive Hinweise; innerhalb davon nach Regel, Pflanzungs-IDs und Zeitraum.
- `lastFrost` ist der letzte Frost des Users als `MM-DD` (`GardenSettings`, T-53); fehlt er, gilt `DEFAULT_LAST_FROST` (15. Mai). Die Regeln bekommen ihn über `RuleContext.lastFrost`. Der Editor übergibt ihn aus `useGardenSettings()` (Gäste: Standard), das Gateway-Tool `evaluate_bed` liest ihn mit dem Token des Users über `GET /api/garden/settings`, damit Assistent und App dieselben Befunde sehen.
- Die Chargen kommen einmal vorberechnet in den Kontext (`RuleContext.sowings`: Charge und verplante Menge je ID, `sowingInfos()`), damit jede Regel nur nachschlägt.
- **Zweiter Einstieg** `evaluateSowings(sowings, plants, { lastFrost? })` liefert `SowingFinding`s (`rule`, `severity`, `sowingId`, `message`) für die Anzucht-Seite, sortiert nach Stufe, Regel und Charge. **Abweichung von „nur `evaluateBed()`“** (Epic #121): Befunde an Chargen haben kein Beet und keine Pflanzungen, an denen sie hängen könnten; sie in `evaluateBed()` zu packen, hätte die Anzucht-Seite gezwungen, ein Beet zu erfinden, und jedem Beet dieselben Befunde zur Charge gegeben. Beide Einstiege nutzen dieselben Bausteine (`sowingInfos()`, `rules/sowing.ts`), die Regeln bleiben rein und isomorph.
- Mit `week` wird trotzdem die ganze Historie ausgewertet (die Fruchtfolge braucht Vorgänger); zurück kommen nur Befunde, deren Zeitraum die ISO-Woche berührt.
- Property-Tests (fast-check) sichern zu: Das Ergebnis hängt nicht von der Reihenfolge der Pflanzungen, Sorten oder Chargen ab (für beide Einstiege), Anzucht-Befunde hängen nur an Pflanzungen bekannter Chargen, Nachbarlisten wirken symmetrisch, Befunde sind wohlgeformt, und der Wochenfilter liefert genau die passende Teilmenge.
- Leistung: 200 Pflanzungen in einem 6 × 3 m Beet über zwei Saisons brauchen im Median etwa 15 ms (Vorgabe: unter 50 ms, auch mit 25 Chargen und jeder zweiten Pflanzung aus einer Charge; `engine.perf.test.ts` misst die CPU-Zeit des Prozesses, damit parallel laufende Test-Suites das Ergebnis nicht verfälschen). Die Fruchtfolge nutzt dafür einen Zellindex mit kleinen ganzzahligen Schlüsseln und prüft Familie und Erneuerung nur einmal pro Paar.

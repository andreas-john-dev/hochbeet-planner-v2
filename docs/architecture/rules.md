# Regel-Engine

Teil der [Architektur](../architecture.md). Die Fachregeln in `packages/garden-rules` (Abstand, Nachbarn, Starkzehrer, Fruchtfolge) und ihre Schnittstelle.

Alle Warnungen werden von einer reinen TypeScript-Bibliothek `packages/garden-rules` berechnet und nie gespeichert. Warnungen blockieren das Speichern nie. Sie veralten deshalb auch nicht, wenn eine Sorte angepasst wird.

Alle Regeln außer der Fruchtfolge gelten nur zwischen Pflanzungen, deren Zeiträume sich überlappen. Der Einflussradius für Nachbarschaft und Starkzehrer beträgt 30 cm und ist als Konstante zentral konfigurierbar.

| Regel | Bedingung | Stufe |
| --- | --- | --- |
| Pflanzabstand | Standflächen zweier Pflanzungen überlappen (Lücke < 0) | Warnung |
| Schlechte Nachbarn | Eine Sorte steht in `badNeighbors` der anderen und die Lücke ist < 30 cm | Warnung |
| Gute Nachbarn | Eine Sorte steht in `goodNeighbors` der anderen, keine Seite markiert das Paar als schlecht, und die Lücke ist < 30 cm | Positiver Hinweis |
| Starkzehrer | Beide sind `STARK`, stehen quer zur Reihenrichtung nebeneinander und die Lücke ist < 30 cm; hintereinander in Reihenrichtung nie | Warnung |
| Fruchtfolge | Auf mindestens einer Rasterzelle gehört der direkte Vorgänger zur selben Familie, und dazwischen wurde die Erde nicht erneuert | Warnung |
| Beetrand | Standfläche ragt über den Beetrand | Dezenter Hinweis |

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

## Schnittstelle

Die Engine erhält ein Beet, alle seine Pflanzungen und die effektiven Sorten des Users: `evaluateBed(bed, plantings, plants, { week? })`. Sie liefert eine Liste von Befunden mit Regel, Stufe, betroffenen Pflanzungs-IDs, Zeitraum und einem deutschen Anzeigetext. Optional kann man auf eine Woche filtern. Die Engine ist isomorph und läuft im Browser wie in Node.

Umsetzung (`packages/garden-rules/src/engine.ts`):

- `evaluateBed` verbindet die Pflanzungen einmal mit ihren Sorten und ruft alle Regeln auf. Die Befunde kommen in fester Reihenfolge: Warnungen, dann dezente Hinweise, dann positive Hinweise; innerhalb davon nach Regel, Pflanzungs-IDs und Zeitraum.
- Mit `week` wird trotzdem die ganze Historie ausgewertet (die Fruchtfolge braucht Vorgänger); zurück kommen nur Befunde, deren Zeitraum die ISO-Woche berührt.
- Property-Tests (fast-check) sichern zu: Das Ergebnis hängt nicht von der Reihenfolge der Pflanzungen oder Sorten ab, Nachbarlisten wirken symmetrisch, Befunde sind wohlgeformt, und der Wochenfilter liefert genau die passende Teilmenge.
- Leistung: 200 Pflanzungen in einem 6 × 3 m Beet über zwei Saisons brauchen im Median etwa 15 ms (Vorgabe: unter 50 ms; `engine.perf.test.ts` misst die CPU-Zeit des Prozesses, damit parallel laufende Test-Suites das Ergebnis nicht verfälschen). Die Fruchtfolge nutzt dafür einen Zellindex mit kleinen ganzzahligen Schlüsseln und prüft Familie und Erneuerung nur einmal pro Paar.

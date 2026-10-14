# Modellvergleich des Beet-Assistenten

Stand: 13. Oktober 2026 (T-45, Issue #95), erster Lauf am selben Tag

Wie gut und wie teuer beantwortet der Beet-Assistent typische Fragen mit verschiedenen Modellen? Dieses Dokument beschreibt den Testsatz, den Lauf und die Ergebnisse.

## Ergebnisse

Erster Lauf am 13. Oktober 2026 ([Workflow-Lauf #2](https://github.com/andreas-john-dev/hochbeet-planner-v2/actions/runs/38359702814), alle 20 Fragen, beide Modelle). Geschätzte Kosten des Laufs (obere Grenze): **0,25 $**.

| Modell           | Fragen bestanden | einfache Aufgaben | Prüfungen bestanden | Tool-Aufrufe/Frage | Tokens ein/aus je Frage | Kosten/Frage | Latenz Median (max) | Fehler |
| ---------------- | ---------------- | ----------------- | ------------------- | ------------------ | ----------------------- | ------------ | ------------------- | ------ |
| Claude Haiku 4.5 | 16/20 (80 %)     | 9/10 (90 %)       | 74/85 (87 %)        | 1,9                | 8.783 / 450             | 0,0121 $     | 7,6 s (276,6 s)     | 1      |
| Amazon Nova Lite | 9/20 (45 %)      | 5/10 (50 %)       | 72/85 (85 %)        | 1,9                | 6.124 / 350             | 0,0006 $     | 3,0 s (16,4 s)      | 0      |

| Frage                | Claude Haiku 4.5                                    | Amazon Nova Lite                                    |
| -------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `warnungen`          | ✓                                                   | ✗ keine IDs                                         |
| `fruchtfolge`        | ✓                                                   | ✗ keine IDs                                         |
| `nachbarn-lauch`     | ✓                                                   | ✗ keine IDs                                         |
| `starkzehrer`        | ✓                                                   | ✓                                                   |
| `spinat`             | ✓                                                   | ✗ keine IDs                                         |
| `gute-nachbarn`      | ✓                                                   | ✗ keine IDs                                         |
| `inhalt`             | ✓                                                   | ✗ keine IDs                                         |
| `fenchel`            | ✓                                                   | ✓                                                   |
| `beet-id`            | ✓                                                   | ✗ keine IDs                                         |
| `abstand-tomate`     | ✓                                                   | ✓                                                   |
| `nachbarn-salat`     | ✓                                                   | ✓                                                   |
| `kartoffel`          | ✓                                                   | ✓                                                   |
| `familie-mangold`    | ✓                                                   | ✓                                                   |
| `beete`              | ✓                                                   | ✓                                                   |
| `englisch`           | ✗ auf Deutsch                                       | ✗ auf Deutsch                                       |
| `mathe`              | ✓                                                   | ✓                                                   |
| `gedicht`            | ✓                                                   | ✓                                                   |
| `vorschlag`          | Fehler (MCP-Verbindung nach 4,5 min geschlossen)    | ✗ Warnungen bleiben                                 |
| `vorschlag-salat`    | ✗ kein Vorschlag                                    | ✗ Warnungen bleiben                                 |
| `vorschlag-kraeuter` | ✗ kein Vorschlag                                    | ✗ kein Vorschlag                                    |

### Was auffällt

- **Erklären und Nachschlagen kann Haiku zuverlässig:** alle 17 Textfragen außer der englischen bestanden, mit knapp 2 Tool-Aufrufen je Frage.
- **Nova Lite nennt IDs:** In 8 der 9 Fragen zum Testbeet stehen ULIDs von Beet oder Pflanzungen in der Antwort, obwohl der Systemprompt das verbietet. Fachlich lagen die Antworten meist richtig (85 % der Prüfungen bestanden), für Nutzer wirken sie aber technisch und unfertig.
- **Englische Fragen bekommen englische Antworten,** bei beiden Modellen, obwohl der Prompt damals „Antworte immer auf Deutsch“ verlangte. Entschieden (14. Oktober 2026): Der Assistent antwortet in der Sprache der Frage; Prompt und Testfall sind angepasst.
- **Pflanzvorschläge bestehen bei keinem Modell.** Nova Lite liefert Vorschläge, aber mit verbleibenden Warnungen der Regel-Engine; bei Kräutern gar keinen. Haiku brach beim ersten Vorschlag nach 4,5 Minuten ab („Connection to the MCP server was closed“) und lieferte danach keine Vorschläge, bei bis zu 0,08 $ je Anfrage. Das deutet auf ein Problem im Vorschlagsmodus selbst (T-43) und nicht nur auf das Modell; es betrifft vermutlich auch prod. Die Ursache klärt T-48 (#111); der Bericht schreibt dafür ab jetzt bei Fehlschlägen Antwort bzw. Fehler ins Job-Log.
- **Kosten:** Nova Lite kostet je Frage etwa 1/20 von Haiku (0,0006 $ statt 0,0121 $) und antwortet im Median doppelt so schnell. Bei 20 Fragen pro Tag und Tester sind das mit Haiku höchstens etwa 0,25 $ pro Tester und Tag.

### Empfehlung

- **Bei Claude Haiku 4.5 bleiben, auch für einfache Aufgaben.** Die Ersparnis mit Nova Lite ist absolut gering (Cent-Beträge pro Tag), dafür verletzt Nova Lite die Regel „keine IDs“ in fast jeder Antwort zum Beet und besteht nur 50 % der einfachen Aufgaben. Ein Wechsel lohnt sich erst, wenn ein neuer Lauf zeigt, dass Nova die Prompt-Regeln einhält (z. B. nach einem Prompt-Fix, der IDs in Tool-Ergebnissen verbirgt).
- **Vorschlagsmodus untersuchen** (T-48, #111), bevor er weiter genutzt oder verglichen wird.
- **Sprache:** entschieden, der Assistent antwortet in der Sprache der Frage (Prompt und Testfall `englisch` angepasst).

## Was verglichen wird

| Schlüssel   | Modell           | Inference-Profil (EU)                         | Preis je 1 Mio. Tokens ein / aus (Schätzung, obere Grenze) |
| ----------- | ---------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `haiku`     | Claude Haiku 4.5 | `eu.anthropic.claude-haiku-4-5-20251001-v1:0` | 1,10 $ / 5,50 $                                            |
| `nova-lite` | Amazon Nova Lite | `eu.amazon.nova-lite-v1:0`                    | 0,08 $ / 0,32 $                                            |

Weitere Modelle kommen in `agents/bed-assistant/evaluation/models.py` dazu (und in die Rolle, siehe unten). Die Preise sind bewusst eher zu hoch angesetzt; die Kosten im Bericht sind also eine obere Grenze.

## Wie gemessen wird

- **Derselbe Agent wie in prod:** Der Lauf nutzt `StrandsResponder` aus `agents/bed-assistant` mit demselben Systemprompt, denselben Tools des AgentCore Gateway (mit dem Token des Smoke-Users) und denselben Grenzen (1024 Ausgabe-Tokens, 6 Tool-Aufrufe, 2 Vorschlagsrunden). Nur die Modell-ID wechselt. Ohne Gedächtnis: jede Frage steht für sich.
- **Feste Beet-Daten:** Vor dem Lauf legt das Skript als Smoke-User das Beet „Eval <Run-ID>“ an (2 × 1 m, das Beispielbeet der Playwright-Tests plus ein Brokkoli vor dem Grünkohl), mit Daten relativ zum Tag des Laufs. Die Regel-Engine meldet darin immer dieselben Fundstellen: Lauch und Rote Bete sowie Rote Bete und Spinat sind schlechte Nachbarn, Grünkohl und Lauch stehen als Starkzehrer zu dicht, Grünkohl folgt auf Brokkoli (Fruchtfolge), Grünkohl und Mangold sind gute Nachbarn. Danach löscht es alle Beete mit dem Präfix „Eval “, auch die abgebrochener Läufe.
- **Prüfungen statt Bewertungsmodell:** Jede Frage hat erwartete Eigenschaften, die ein Skript prüft (Wörter, genutzte Tools, Vorschläge im Beet, keine verbleibenden Warnungen). Zusätzlich gilt für jede Textantwort: keine IDs, in der Sprache der Frage (Deutsch, beim Fall `englisch` Englisch), höchstens 220 Wörter. Eine Frage ist bestanden, wenn alle ihre Prüfungen bestehen.
- **Kennzahlen je Modell:** bestandene Fragen (auch nur die einfachen Aufgaben), bestandene Prüfungen, Tool-Aufrufe, Tokens ein/aus und Kosten je Frage, Latenz (Median und Maximum, gemessen vom Runner aus).
- **Kostengrenze:** Der Lauf bricht ab (überspringt die übrigen Fragen), bevor die geschätzten Kosten 0,90 $ überschreiten könnten; jede Frage wird dafür mit höchstens 0,05 $ angesetzt. Der Bericht nennt die Kosten des Laufs.

## Testsatz

„einfach“ markiert die Aufgaben, um die es in der Empfehlung geht (z. B. eine Warnung erklären).

| Fall                 | Frage                                           | Beet | Art       | Prüfungen                                                                    |
| -------------------- | ----------------------------------------------- | ---- | --------- | ---------------------------------------------------------------------------- |
| `warnungen`          | Welche Warnungen hat mein Beet?                 | ja   | –         | nutzt evaluate_bed; nennt Brokkoli oder Fruchtfolge, Rote Bete, Spinat, Lauch |
| `fruchtfolge`        | Warum bekomme ich eine Warnung zur Fruchtfolge? | ja   | einfach   | nennt Grünkohl, Brokkoli, Kreuzblütler                                       |
| `nachbarn-lauch`     | Was ist das Problem mit Lauch und Roter Bete?   | ja   | einfach   | nennt Nachbar                                                                |
| `starkzehrer`        | Warum warnt der Planer bei Grünkohl und Lauch?  | ja   | einfach   | nennt Starkzehrer, 30 cm oder Abstand                                        |
| `spinat`             | Erkläre mir die Warnung zu Roter Bete und Spinat. | ja | einfach   | nennt Spinat, Nachbar                                                        |
| `gute-nachbarn`      | Gibt es in meinem Beet auch gute Nachbarn?      | ja   | einfach   | nennt Mangold, Grünkohl                                                      |
| `inhalt`             | Was wächst gerade in meinem Beet?               | ja   | –         | nutzt get_bed; nennt Grünkohl, Lauch, Spinat, Mangold                        |
| `fenchel`            | Kann ich in diesem Beet noch Fenchel pflanzen?  | ja   | –         | nutzt ein Tool; nennt Fenchel                                                |
| `beet-id`            | Wie lautet die ID von diesem Beet?              | ja   | –         | nur die allgemeinen Prüfungen (also keine ID)                                |
| `abstand-tomate`     | Wie viel Abstand brauchen Tomaten?              | –    | einfach   | nutzt find_plants; nennt 60                                                  |
| `nachbarn-salat`     | Welche guten Nachbarn hat Kopfsalat?            | –    | einfach   | nutzt find_plants; nennt Radieschen, Kohlrabi, Tomate oder Erdbeere          |
| `kartoffel`          | Darf ich Tomaten neben Kartoffeln pflanzen?     | –    | einfach   | nennt nicht, schlecht oder besser                                            |
| `familie-mangold`    | Zu welcher Pflanzenfamilie gehört Mangold?      | –    | einfach   | nennt Fuchsschwanz                                                           |
| `beete`              | Welche Beete habe ich?                          | –    | –         | nutzt list_beds; nennt Eval                                                  |
| `englisch`           | How far apart should I plant tomatoes?          | –    | einfach   | nennt 60 (und antwortet auf Englisch)                                        |
| `mathe`              | Was ist 5+5?                                    | –    | –         | ohne Tools; rechnet nicht                                                    |
| `gedicht`            | Schreib mir ein Gedicht über Autos.             | –    | –         | ohne Tools; lenkt auf Garten, Beet oder Pflanzen                             |
| `vorschlag`          | Was kann ich in dieses Beet noch pflanzen?      | ja   | Vorschlag | mindestens ein Vorschlag, im Beet, ohne verbleibende Warnungen               |
| `vorschlag-salat`    | Ich möchte noch Salat ergänzen.                 | ja   | Vorschlag | wie oben, und ein Salat ist dabei                                            |
| `vorschlag-kraeuter` | Welche Kräuter passen noch dazu?                | ja   | Vorschlag | wie oben                                                                     |

## Lauf starten

- **In GitHub:** Actions → *Assistant evaluation* → *Run workflow* (nur auf `main`). Eingaben: Modelle (Standard `haiku,nova-lite`) und optional einzelne Fälle. Der Job läuft in der Umgebung `prod`, schreibt den Bericht ins Job-Summary und legt `report.md` und `results.json` (mit allen Antworten) als Artefakt `assistant-evaluation` ab.
- **Lokal** (mit AWS-Zugang, der die Modelle aufrufen und den SSM-Parameter lesen darf):

  ```bash
  cd agents/bed-assistant
  SMOKE_USER_EMAIL=… SMOKE_USER_PASSWORD=… PYTHONPATH=src uv run python -m evaluation --models haiku,nova-lite
  ```

- **Einmalige Einrichtung:** die Rolle `hochbeet-github-assistant-eval` aus `infra/bootstrap/github-assistant-eval-role.yaml` und die Variable `AWS_ASSISTANT_EVAL_ROLE_ARN`, siehe `docs/deployment.md`, Abschnitt „Modellvergleich einrichten“.

## Warum ein eigenes Skript statt AgentCore Evaluations

AgentCore Evaluations bewertet Traces der Runtime mit einem Bewertungsmodell. Das setzt Traces in CloudWatch voraus (X-Ray Transaction Search), die im Konto bewusst aus sind (siehe `docs/architecture.md`, Runtime), und jedes Urteil wäre ein weiterer Modellaufruf. Außerdem darf die Runtime-Rolle nur ein Modell aufrufen; ein Vergleich über die Runtime hätte ihre Rechte erweitert. Das Skript nutzt denselben Agenten-Code mit einer eigenen, schmalen Rolle, prüft die Antworten regelbasiert (reproduzierbar, ohne Zusatzkosten) und misst Tokens und Tool-Aufrufe direkt aus Strands.

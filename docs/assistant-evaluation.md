# Modellvergleich des Beet-Assistenten

Stand: 13. Oktober 2026 (T-45, Issue #95)

Wie gut und wie teuer beantwortet der Beet-Assistent typische Fragen mit verschiedenen Modellen? Dieses Dokument beschreibt den Testsatz, den Lauf und die Ergebnisse.

## Ergebnisse

> Noch kein Lauf. Den ersten Lauf startet der Workflow `Assistant evaluation`, sobald die Rolle eingerichtet ist (siehe „Lauf starten“). Danach stehen hier die Tabelle aus dem Job-Summary, die Kosten des Laufs und die Empfehlung.

## Was verglichen wird

| Schlüssel   | Modell           | Inference-Profil (EU)                         | Preis je 1 Mio. Tokens ein / aus (Schätzung, obere Grenze) |
| ----------- | ---------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `haiku`     | Claude Haiku 4.5 | `eu.anthropic.claude-haiku-4-5-20251001-v1:0` | 1,10 $ / 5,50 $                                            |
| `nova-lite` | Amazon Nova Lite | `eu.amazon.nova-lite-v1:0`                    | 0,08 $ / 0,32 $                                            |

Weitere Modelle kommen in `agents/bed-assistant/evaluation/models.py` dazu (und in die Rolle, siehe unten). Die Preise sind bewusst eher zu hoch angesetzt; die Kosten im Bericht sind also eine obere Grenze.

## Wie gemessen wird

- **Derselbe Agent wie in prod:** Der Lauf nutzt `StrandsResponder` aus `agents/bed-assistant` mit demselben Systemprompt, denselben Tools des AgentCore Gateway (mit dem Token des Smoke-Users) und denselben Grenzen (1024 Ausgabe-Tokens, 6 Tool-Aufrufe, 2 Vorschlagsrunden). Nur die Modell-ID wechselt. Ohne Gedächtnis: jede Frage steht für sich.
- **Feste Beet-Daten:** Vor dem Lauf legt das Skript als Smoke-User das Beet „Eval <Run-ID>“ an (2 × 1 m, das Beispielbeet der Playwright-Tests plus ein Brokkoli vor dem Grünkohl), mit Daten relativ zum Tag des Laufs. Die Regel-Engine meldet darin immer dieselben Fundstellen: Lauch und Rote Bete sowie Rote Bete und Spinat sind schlechte Nachbarn, Grünkohl und Lauch stehen als Starkzehrer zu dicht, Grünkohl folgt auf Brokkoli (Fruchtfolge), Grünkohl und Mangold sind gute Nachbarn. Danach löscht es alle Beete mit dem Präfix „Eval “, auch die abgebrochener Läufe.
- **Prüfungen statt Bewertungsmodell:** Jede Frage hat erwartete Eigenschaften, die ein Skript prüft (Wörter, genutzte Tools, Vorschläge im Beet, keine verbleibenden Warnungen). Zusätzlich gilt für jede Textantwort: keine IDs, auf Deutsch, höchstens 220 Wörter. Eine Frage ist bestanden, wenn alle ihre Prüfungen bestehen.
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
| `englisch`           | How far apart should I plant tomatoes?          | –    | einfach   | nennt 60 (und antwortet auf Deutsch)                                         |
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

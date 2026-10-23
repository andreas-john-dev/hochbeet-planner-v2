# Startkatalog

Stand: 23. Oktober 2026 (geprüft in T-46, Aussaat und Anzucht ergänzt in T-50, siehe [Prüfprotokoll](#prüfprotokoll))

Der Startkatalog umfasst 56 Sorten: 43 Gemüse, die Erdbeere als Obst und 12 Kräuter. Er ist die Quelle für `packages/catalog-seed`. Jeder User kann alle Werte für sich überschreiben.

- **Abstände** sind Endabstände im Freiland nach BZfE, sonst nach meine ernte. Im Hochbeet wird oft etwas enger gepflanzt.
- **Standzeit** sind geschätzte Wochen im Beet bis Ernteende, gezählt ab dem Tag, an dem die Pflanze ins Beet kommt: bei vorgezogenen Sorten ab dem Auspflanzen, bei Direktsaat ab der Aussaat. Abgeleitet aus Kulturdauer und Erntezeitraum der Quellen; eine Vorkultur zählt nie mit. Im Seed wird daraus `lifecycle`: „N Wo.“ = `ANNUAL` mit `cultureWeeks: N`, „3 Jahre“ = `MULTI_YEAR` mit `years: 3`, „dauerhaft“ = `PERENNIAL`.
- **Bedarf** folgt Plantura und Hornbach. Kräuter ohne Einzelangabe gelten als Schwachzehrer, Chili übernimmt die Werte von Paprika. Basilikum ist Mittelzehrer (Entscheidung des Product Owners, siehe Prüfprotokoll).
- **Nachbarn** folgen der BUND-Mischkulturtabelle. Für Sorten und Kräuter, die BUND nicht führt, ergänzen Plantura-Artikel die Paare (siehe Quellen). Ein Paar steht nur bei der Sorte, deren Quelle es nennt; der Seed macht die Listen symmetrisch, sodass jede Sorte auch die Paare der anderen Seite zeigt. „–“ heißt, die Quelle der Sorte nennt nichts.
- **Kurzformen**, die der Seed auflöst:
  - Kohl = Blumenkohl, Brokkoli, Grünkohl, Rosenkohl, Rotkohl, Weißkohl, Wirsing (nicht Kohlrabi, Chinakohl)
  - andere Kohlarten = Kohl ohne die Sorte selbst
  - Sellerie = Knollensellerie, Staudensellerie
  - Bohnen = Buschbohne, Stangenbohne
  - „wie X“ = dieselben Nachbarlisten wie Sorte X
- **Aussaat und Anzucht** (Tabelle [Aussaat und Anzucht](#aussaat-und-anzucht)) folgen der BZfE-Tabelle, ergänzt um Plantura; die Regeln stehen dort.
- **Widersprüche** in den Quellen, etwa Tomate und Zuckermais, Kohl und Erdbeere oder Rote Bete und Kartoffel, löst die Regel „Warnung sticht“: Ein Paar gilt als schlechter Nachbar, sobald eine Seite es so markiert.

Auffällig: Laut BUND sind Sellerie und Kopfsalat gute Nachbarn.

## Sorten

| Sorte | Kategorie | Familie | Bedarf | In der Reihe (cm) | Reihenabstand (cm) | Standzeit | Gute Nachbarn | Schlechte Nachbarn |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Aubergine | Gemüse | Nachtschattengewächse | Stark | 40 | 40 | 16 Wo. | Blumenkohl, Brokkoli, Weißkohl, Rotkohl, Wirsing, Kopfsalat, Pflücksalat, Spinat | Tomate, Paprika, Chili, Zucchini, Kürbis |
| Blumenkohl | Gemüse | Kreuzblütler | Stark | 60 | 60 | 14 Wo. | wie Brokkoli | wie Brokkoli |
| Brokkoli | Gemüse | Kreuzblütler | Stark | 50 | 50 | 12 Wo. | Tomate, Bohnen, Spinat, Sellerie, Kopfsalat, Pflücksalat, Salatgurke, Radieschen, Rettich, Mangold, Lauch, Erbse, Endivie, Rhabarber | andere Kohlarten, Zwiebel, Knoblauch, Kartoffel, Erdbeere |
| Buschbohne | Gemüse | Hülsenfrüchtler | Schwach | 7 | 45 | 12 Wo. | Tomate, Sellerie, Radieschen, Rettich, Rote Bete, Pflücksalat, Mangold, Salatgurke, Kopfsalat, Kohlrabi, Kohl, Kartoffel, Rhabarber | Zwiebel, Lauch, Knoblauch, Fenchel, Erbse |
| Chili | Gemüse | Nachtschattengewächse | Stark | 40 | 40 | 20 Wo. | wie Paprika | wie Paprika |
| Chinakohl | Gemüse | Kreuzblütler | Mittel | 30 | 40 | 10 Wo. | – | – |
| Endivie | Gemüse | Korbblütler | Mittel | 30 | 40 | 12 Wo. | Stangenbohne, Lauch, Kohl, Fenchel | Tomate, Buschbohne, Paprika, Kohlrabi |
| Erbse | Gemüse | Hülsenfrüchtler | Schwach | 4 | 40 | 12 Wo. | Radieschen, Rettich, Kopfsalat, Kohl, Kohlrabi, Fenchel, Dill, Möhre | Tomate, Bohnen, Lauch, Knoblauch, Kartoffel |
| Feldsalat | Gemüse | Baldriangewächse | Schwach | 2 | 15 | 14 Wo. | Fenchel, Zwiebel, Erdbeere, Endivie, Kohl, Radieschen, Lauch, Buschbohne | – |
| Fenchel | Gemüse | Doldenblütler | Mittel | 20 | 45 | 12 Wo. | Endivie, Radicchio, Salbei, Pflücksalat, Kopfsalat, Salatgurke, Erbse | Bohnen, Tomate |
| Frühlingszwiebel | Gemüse | Lauchgewächse | Schwach | 3 | 30 | 10 Wo. | wie Zwiebel | wie Zwiebel |
| Grünkohl | Gemüse | Kreuzblütler | Stark | 50 | 50 | 30 Wo. | wie Brokkoli | wie Brokkoli |
| Kartoffel | Gemüse | Nachtschattengewächse | Stark | 30 | 60 | 18 Wo. | Spinat, Pfefferminze, Kohlrabi, Dill, Buschbohne | Tomate, Sellerie, Erbse, Rote Bete, Kohl |
| Knoblauch | Gemüse | Lauchgewächse | Schwach | 15 | 20 | 38 Wo. | Tomate, Rote Bete, Salatgurke, Möhre, Erdbeere | Bohnen, Erbse, Kohl |
| Knollensellerie | Gemüse | Doldenblütler | Stark | 40 | 40 | 22 Wo. | Tomate, Stangenbohne, Spinat, Lauch, Kopfsalat, Kohlrabi, Kohl, Salatgurke, Buschbohne | Zuckermais, Kartoffel |
| Kohlrabi | Gemüse | Kreuzblütler | Mittel | 25 | 30 | 9 Wo. | Tomate, Bohnen, Spinat, Sellerie, Lauch, Kartoffel, Erbse, Schwarzwurzel, Rote Bete, Radieschen, Rettich, Kopfsalat | – |
| Kopfsalat | Gemüse | Korbblütler | Mittel | 25 | 30 | 8 Wo. | Zwiebel, Endivie, Radicchio, Tomate, Bohnen, Kohlrabi, Kohl, Schwarzwurzel, Rhabarber, Dill, Radieschen, Rettich, Salatgurke, Fenchel, Erdbeere, Erbse, Pfefferminze, Zuckermais, Lauch | Petersilie |
| Kürbis | Gemüse | Kürbisgewächse | Stark | 150 | 150 | 20 Wo. | Bohnen, Zuckermais, Kohlrabi, Erbse, Zwiebel | Salatgurke, Tomate |
| Lauch | Gemüse | Lauchgewächse | Stark | 15 | 40 | 22 Wo. | Tomate, Sellerie, Schwarzwurzel, Kopfsalat, Kohlrabi, Kohl, Möhre, Endivie, Erdbeere | Bohnen, Erbse, Rote Bete |
| Mangold | Gemüse | Fuchsschwanzgewächse | Mittel | 30 | 40 | 20 Wo. | Radieschen, Rettich, Kohl, Möhre, Buschbohne | – |
| Möhre | Gemüse | Doldenblütler | Mittel | 4 | 25 | 14 Wo. | Zwiebel, Endivie, Radicchio, Tomate, Schwarzwurzel, Erbse, Dill, Lauch, Knoblauch, Radieschen, Rettich, Mangold | – |
| Paprika | Gemüse | Nachtschattengewächse | Stark | 40 | 40 | 18 Wo. | Möhre, Zwiebel, Lauch, Salatgurke, Erdbeere | Fenchel |
| Pastinake | Gemüse | Doldenblütler | Mittel | 20 | 35 | 30 Wo. | Zwiebel, Knoblauch, Lauch, Kopfsalat, Pflücksalat, Radicchio, Mangold, Rote Bete, Bohnen, Erbse | Möhre, Petersilie, Fenchel, Sellerie |
| Pflücksalat | Gemüse | Korbblütler | Mittel | 35 | 35 | 10 Wo. | Tomate, Schwarzwurzel, Rhabarber, Rote Bete, Radieschen, Rettich, Kohl, Fenchel, Dill, Buschbohne | – |
| Radicchio | Gemüse | Korbblütler | Mittel | 20 | 30 | 16 Wo. | Tomate, Stangenbohne, Kopfsalat, Möhre, Fenchel | – |
| Radieschen | Gemüse | Kreuzblütler | Schwach | 5 | 10 | 5 Wo. | Tomate, Bohnen, Spinat, Pflücksalat, Petersilie, Mangold, Kopfsalat, Kohl, Möhre, Kohlrabi, Kapuzinerkresse, Erdbeere, Erbse | Salatgurke |
| Rettich | Gemüse | Kreuzblütler | Mittel | 15 | 30 | 9 Wo. | wie Radieschen | wie Radieschen |
| Rhabarber | Gemüse | Knöterichgewächse | Stark | 120 | 120 | dauerhaft | Spinat, Pflücksalat, Kopfsalat, Kohl, Buschbohne | – |
| Rosenkohl | Gemüse | Kreuzblütler | Stark | 60 | 60 | 30 Wo. | wie Brokkoli | wie Brokkoli |
| Rote Bete | Gemüse | Fuchsschwanzgewächse | Mittel | 10 | 30 | 20 Wo. | Zwiebel, Pflücksalat, Kohlrabi, Knoblauch, Salatgurke, Erdbeere, Dill, Buschbohne | Zuckermais, Lauch, Kartoffel |
| Rotkohl | Gemüse | Kreuzblütler | Stark | 50 | 60 | 20 Wo. | wie Brokkoli | wie Brokkoli |
| Rucola | Gemüse | Kreuzblütler | Schwach | 3 | 20 | 6 Wo. | Kopfsalat, Pflücksalat, Sellerie, Zwiebel, Basilikum, Tomate | Spinat, Koriander, Erbse, Kohl, Kohlrabi, Chinakohl, Radieschen, Rettich |
| Salatgurke | Gemüse | Kürbisgewächse | Stark | 40 | 100 | 16 Wo. | Zwiebel, Bohnen, Sellerie, Rote Bete, Kopfsalat, Kohl, Knoblauch, Dill, Fenchel | Radieschen, Rettich |
| Schwarzwurzel | Gemüse | Korbblütler | Mittel | 10 | 25 | 30 Wo. | Zwiebel, Pflücksalat, Lauch, Kopfsalat, Kohlrabi, Möhre | – |
| Spinat | Gemüse | Fuchsschwanzgewächse | Mittel | 10 | 15 | 8 Wo. | Tomate, Stangenbohne, Sellerie, Rhabarber, Radieschen, Rettich, Kohlrabi, Kohl, Kartoffel, Erdbeere | Rote Bete, Mangold |
| Stangenbohne | Gemüse | Hülsenfrüchtler | Schwach | 80 | 80 | 16 Wo. | Zucchini, Endivie, Radicchio, Spinat, Sellerie, Radieschen, Rettich, Kopfsalat, Kohlrabi, Kohl, Kapuzinerkresse, Salatgurke | Zwiebel, Lauch, Knoblauch, Fenchel, Erbse |
| Staudensellerie | Gemüse | Doldenblütler | Stark | 40 | 40 | 18 Wo. | wie Knollensellerie | wie Knollensellerie |
| Tomate | Gemüse | Nachtschattengewächse | Stark | 60 | 60 | 22 Wo. | Radicchio, Spinat, Sellerie, Radieschen, Rettich, Pflücksalat, Pfefferminze, Petersilie, Kopfsalat, Kohlrabi, Kohl, Knoblauch, Möhre, Buschbohne, Lauch, Stangenbohne, Zwiebel, Basilikum | Kartoffel, Fenchel, Erbse, Salatgurke |
| Weißkohl | Gemüse | Kreuzblütler | Stark | 50 | 60 | 20 Wo. | wie Brokkoli | wie Brokkoli |
| Wirsing | Gemüse | Kreuzblütler | Stark | 50 | 50 | 18 Wo. | wie Brokkoli | wie Brokkoli |
| Zucchini | Gemüse | Kürbisgewächse | Stark | 100 | 100 | 18 Wo. | Zwiebel, Stangenbohne | – |
| Zuckermais | Gemüse | Süßgräser | Stark | 30 | 40 | 16 Wo. | Kopfsalat, Kürbis, Salatgurke, Kartoffel | Sellerie, Rote Bete, Tomate |
| Zwiebel | Gemüse | Lauchgewächse | Schwach | 10 | 25 | 22 Wo. | Zucchini, Schwarzwurzel, Rote Bete, Dill, Salatgurke, Kopfsalat, Möhre, Erdbeere | Bohnen, Kohl |
| Erdbeere | Obst | Rosengewächse | Mittel | 30 | 90 | 3 Jahre | Radieschen, Rettich, Rote Bete, Petersilie, Lauch, Knoblauch, Buschbohne, Kopfsalat, Zwiebel, Spinat | Kohl, Kartoffel, Tomate |
| Basilikum | Kraut | Lippenblütler | Mittel | 25 | 25 | 16 Wo. | Tomate | Pfefferminze |
| Bohnenkraut | Kraut | Lippenblütler | Schwach | 25 | 25 | 16 Wo. | Bohnen | – |
| Dill | Kraut | Doldenblütler | Schwach | 30 | 30 | 10 Wo. | Zwiebel, Rote Bete, Pflücksalat, Möhre, Salatgurke, Erbse, Kopfsalat | Fenchel, Koriander |
| Kapuzinerkresse | Kraut | Kapuzinerkressengewächse | Schwach | 10 | 20 | 20 Wo. | Stangenbohne, Radieschen, Rettich, Zucchini, Salatgurke, Kürbis | – |
| Koriander | Kraut | Doldenblütler | Schwach | 15 | 30 | 10 Wo. | Salatgurke, Rote Bete, Basilikum | Dill, Fenchel, Möhre, Sellerie |
| Oregano | Kraut | Lippenblütler | Schwach | 15 | 20 | dauerhaft | Thymian, Basilikum, Salbei, Rosmarin, Schnittlauch | Pfefferminze |
| Petersilie | Kraut | Doldenblütler | Schwach | 5 | 20 | 30 Wo. | Tomate, Radieschen, Rettich, Erdbeere, Schnittlauch, Basilikum, Koriander | Kopfsalat, Dill |
| Pfefferminze | Kraut | Lippenblütler | Schwach | 30 | 30 | dauerhaft | Tomate, Kopfsalat, Möhre, Kartoffel | – |
| Rosmarin | Kraut | Lippenblütler | Schwach | 50 | 50 | dauerhaft | Basilikum, Oregano, Thymian, Salbei, Fenchel, Zwiebel, Lauch | – |
| Salbei | Kraut | Lippenblütler | Schwach | 40 | 30 | dauerhaft | Fenchel, Oregano, Bohnenkraut, Rosmarin, Thymian | – |
| Schnittlauch | Kraut | Lauchgewächse | Schwach | 20 | 25 | dauerhaft | Erdbeere, Salatgurke, Schwarzwurzel, Rettich, Tomate, Dill, Petersilie, Thymian | Zwiebel, Frühlingszwiebel, Knoblauch, Lauch, Grünkohl, Kohlrabi, Radieschen |
| Thymian | Kraut | Lippenblütler | Schwach | 20 | 20 | dauerhaft | Rosmarin, Salbei, Fenchel, Koriander | – |

Bei der Stangenbohne bezeichnen 80 × 80 cm den Abstand der Stangen; an jeder Stange stehen 6–8 Pflanzen.

## Aussaat und Anzucht

Wie auf der Rückseite einer Samentüte: wann vorgezogen oder direkt gesät wird, wie lange die Vorkultur dauert und wie die Samen keimen. Im Seed wird daraus `sowing` und `frostSensitive` (siehe [Domänenmodell](./architecture/domain.md#aussaat-und-anzucht-sowing)).

- **Aussaat:** „Vorkultur“ = `PRESOW`, „Direktsaat“ = `DIRECT`, „beides“ = `BOTH`, je nachdem, ob die BZfE-Tabelle Anzucht, Direktsaat oder beides nennt. Fehlt eine Sorte bei BZfE (Chili), gilt Plantura. „Pflanzgut“ heißt: Die Sorte kommt als fertige Pflanze oder Ableger ins Beet und hat keine Aussaatangaben (Erdbeere, Pfefferminze, Rhabarber, Rosmarin). Kartoffel, Knoblauch und Zwiebel werden gelegt bzw. gesteckt und gelten als Direktsaat.
- **Wochen (KW):** ISO-Kalenderwochen, umgerechnet aus den Monatsdritteln der BZfE-Tabelle mit dem Jahr 2026: Anfang = KW des 5., Mitte = KW des 15., Ende = KW des 25. des Monats; ein Monat ohne Zusatz zählt am Fensterbeginn als Anfang, am Fensterende als Ende. Beispiel: „M. Mär–M. Apr“ = KW 11–16.
- **Mehrere Sätze** (z. B. Kohlrabi früh und spät) werden zu einem Fenster zusammengefasst, wenn sie lückenlos aneinander anschließen. Sonst gilt der Satz, zu dem Abstand und Standzeit im Katalog passen; die anderen stehen im Prüfprotokoll.
- **Offene Enden** der BZfE-Tabelle („ab M. Mai“) schließt Plantura bzw. meine ernte; das Prüfprotokoll nennt jeden Fall.
- **Vorkultur (Wo.):** Wochen von der Aussaat bis zum Auspflanzen, aus der BZfE-Tabelle abgeleitet (Beginn der Anzucht bis Beginn der Pflanzung und Ende bis Ende, je Satz), erweitert um eine ausdrückliche Dauer bei Plantura.
- **Pikieren:** nur, wenn Plantura eine Zahl der Wochen nach der Aussaat nennt.
- **Zuschlag:** Bei einjährigen Sorten, die vorgezogen oder direkt gesät werden, steht eine Direktsaat um die kürzeste Vorkulturdauer länger im Beet (`directSowExtraWeeks`). Reine Direktsaaten haben keinen Zuschlag, weil ihre Standzeit schon ab der Aussaat zählt.
- **Keimung:** Keimdauer und Keimtemperatur nach Plantura, sonst nach Kiepenkerl, Bingenheimer Saatgut oder Gartenjournal (siehe Quellen). Werte, die nur in der Gartenjournal-Sammeltabelle stehen, fehlen, weil die Tabelle unsauber ist.
- **Frost:** „empfindlich“ heißt, die Sorte kommt erst nach dem letzten Frost ins Freie (`frostSensitive`), nach Plantura. Bei Oregano, Salbei und Thymian gilt das für Aussaat und Jungpflanzen; ältere Pflanzen sind winterhart.

| Sorte | Aussaat | Vorkultur (KW) | Vorkultur (Wo.) | Pikieren (Wo.) | Direktsaat (KW) | Zuschlag (Wo.) | Keimung (Tage) | Keimung (°C) | Frost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Aubergine | Vorkultur | 11–16 | 7–9 | – | – | – | 7–21 | 20–25 | empfindlich |
| Blumenkohl | Vorkultur | 13–27 | 3–6 | – | – | – | – | 15–20 | – |
| Brokkoli | Vorkultur | 13–27 | 5–6 | 4 | – | – | – | 15–20 | – |
| Buschbohne | Direktsaat | – | – | – | 19–29 | – | 11–30 | 20 | empfindlich |
| Chili | Vorkultur | 3–10 | 10–17 | – | – | – | 10–20 | 20 | empfindlich |
| Chinakohl | beides | 16–29 | 4 | – | 29–32 | 4 | – | 15–18 | – |
| Endivie | Vorkultur | 16–30 | 3–4 | – | – | – | 8–14 | 16–20 | – |
| Erbse | Direktsaat | – | – | – | 11–25 | – | 8–12 | 15–20 | – |
| Feldsalat | Direktsaat | – | – | – | 30–36 | – | 14 | 10–20 | – |
| Fenchel | beides | 14–26 | 4–5 | – | 16–27 | 4 | 10–14 | 18–22 | – |
| Frühlingszwiebel | Direktsaat | – | – | – | 10–30 | – | 14–28 | 15–20 | – |
| Grünkohl | Vorkultur | 19–26 | 4–6 | – | – | – | 3–7 | 18 | – |
| Kartoffel | Direktsaat | – | – | – | 16–22 | – | – | – | – |
| Knoblauch | Direktsaat | – | – | – | 40–46 | – | – | – | – |
| Knollensellerie | Vorkultur | 10–17 | 5–12 | – | – | – | 14 | 20 | empfindlich |
| Kohlrabi | Vorkultur | 10–25 | 4–6 | 4 | – | – | 7–14 | 20 | – |
| Kopfsalat | beides | 10–30 | 3–4 | – | 13–30 | 3 | 10–14 | 15–18 | – |
| Kürbis | beides | 16–17 | 3–4 | – | 20–25 | 3 | 7–14 | 20–24 | empfindlich |
| Lauch | Vorkultur | 11–17 | 11–15 | – | – | – | 15–20 | 16–20 | – |
| Mangold | Direktsaat | – | – | – | 16–22 | – | 14 | 18–20 | – |
| Möhre | Direktsaat | – | – | – | 10–29 | – | 14–28 | 10–25 | – |
| Paprika | Vorkultur | 11–16 | 7–9 | – | – | – | 10–14 | 25 | empfindlich |
| Pastinake | Direktsaat | – | – | – | 10–22 | – | 14–21 | 15–20 | – |
| Pflücksalat | beides | 10–30 | 4–5 | – | 11–30 | 4 | 10–14 | 15 | – |
| Radicchio | Direktsaat | – | – | – | 25–29 | – | 10–14 | 20–25 | empfindlich |
| Radieschen | Direktsaat | – | – | – | 7–33 | – | – | 15 | – |
| Rettich | Direktsaat | – | – | – | 14–33 | – | 8–10 | 14–15 | – |
| Rhabarber | Pflanzgut | – | – | – | – | – | – | – | – |
| Rosenkohl | Vorkultur | 11–16 | 6–7 | – | – | – | 10–15 | 15–20 | – |
| Rote Bete | Direktsaat | – | – | – | 11–27 | – | 12–14 | 15–20 | – |
| Rotkohl | Vorkultur | 4–17 | 9–11 | – | – | – | – | 15 | – |
| Rucola | Direktsaat | – | – | – | 14–36 | – | 10–14 | 10–20 | – |
| Salatgurke | Direktsaat | – | – | – | 20–25 | – | 4–7 | 20–24 | empfindlich |
| Schwarzwurzel | Direktsaat | – | – | – | 10–17 | – | 14–21 | 12–18 | – |
| Spinat | Direktsaat | – | – | – | 10–16 | – | 7–14 | 10–20 | – |
| Stangenbohne | Direktsaat | – | – | – | 20–27 | – | 11–30 | 20 | empfindlich |
| Staudensellerie | Vorkultur | 10–17 | 5–12 | – | – | – | 14–21 | 18–20 | empfindlich |
| Tomate | Vorkultur | 11–16 | 7–13 | 2 | – | – | 3–10 | 20–22 | empfindlich |
| Weißkohl | Vorkultur | 4–17 | 9–11 | – | – | – | 7–10 | 18–22 | – |
| Wirsing | Vorkultur | 6–22 | 4–9 | – | – | – | – | – | – |
| Zucchini | beides | 14–19 | 4–6 | – | 20–25 | 4 | 7–10 | 18–20 | empfindlich |
| Zuckermais | beides | 14–16 | 2–5 | – | 20–23 | 2 | 5–15 | 25 | empfindlich |
| Zwiebel | Direktsaat | – | – | – | 10–17 | – | – | – | – |
| Erdbeere | Pflanzgut | – | – | – | – | – | – | – | – |
| Basilikum | Vorkultur | 11–16 | 4–9 | 4 | – | – | 7–14 | 18–22 | empfindlich |
| Bohnenkraut | beides | 10–17 | 8–10 | – | 20–25 | 8 | 21–28 | 16–20 | empfindlich |
| Dill | Direktsaat | – | – | – | 14–33 | – | 21 | 15 | – |
| Kapuzinerkresse | Direktsaat | – | – | – | 14–26 | – | 7–10 | 20–25 | empfindlich |
| Koriander | Direktsaat | – | – | – | 14–22 | – | 14–21 | 12–22 | – |
| Oregano | beides | 6–13 | 9–13 | – | 14–19 | – | 7–14 | 16–20 | empfindlich |
| Petersilie | Direktsaat | – | – | – | 10–22 | – | 14–30 | 12–16 | – |
| Pfefferminze | Pflanzgut | – | – | – | – | – | – | – | – |
| Rosmarin | Pflanzgut | – | – | – | – | – | – | – | empfindlich |
| Salbei | beides | 16–19 | 4 | – | 20–30 | – | 14–21 | 18–22 | empfindlich |
| Schnittlauch | beides | 10–17 | 5 | – | 14–17 | – | 7–14 | 12–18 | – |
| Thymian | Direktsaat | – | – | – | 14–35 | – | – | 16 | empfindlich |

## Quellen

- [BZfE: Tabelle Aussaat und Pflanzzeiten](https://www.landwirtschaft.de/fileadmin/SITE_MASTER/content/Downloads/Tabelle_Aussaat_und_Pflanzzeiten.pdf) (aid-Heft 1559 „Von Apfel bis Zucchini – Das Jahr im Garten“) – Abstände, Erntezeiträume. Liegt seit 2026 bei landwirtschaft.de; die alte Adresse auf bzfe.de liefert 404.
- [BUND: Mischkultur – gute und schlechte Nachbarn](https://www.bund.net/fileadmin/user_upload_bund/publikationen/naturnahes-gaertnern/Mischkultur-Gemuese-BUND.pdf) – Nachbarschaften
- [meine ernte: Aussaat- und Pflanzkalender](https://www.meine-ernte.de/fileadmin/fieldupload/Aussaat-_und_Pflanzkalender.pdf) – Pflanzenfamilien, Kulturdauer, Abstände für Zucchini, Gurke und Rucola
- [Plantura: Starkzehrer, Mittelzehrer & Schwachzehrer](https://www.plantura.garden/gemuese/gemuese-anbauen/starkzehrer-mittelzehrer-und-schwachzehrer) – Nährstoffbedarf
- [Hornbach: Mischkultur im Garten](https://www.hornbach.de/projekte/mischkultur-im-garten/) – Nährstoffbedarf für Salate und Rucola
- Plantura, Nachbarn für Sorten ohne BUND-Eintrag:
  [Welche Kräuter passen zusammen?](https://www.plantura.garden/kraeuter/kraeuter-anbauen/welche-kraeuter-passen-zusammen),
  [Mischkultur bei Tomaten](https://www.plantura.garden/gemuese/tomaten/mischkultur-bei-tomaten),
  [Pflanzenkombinationen für Mischkulturen](https://www.plantura.garden/gartenpraxis/mischkultur/pflanzenkombinationen-fuer-mischkulturen),
  [Aubergine](https://www.plantura.garden/gemuese/auberginen/auberginen-pflanzen),
  [Feldsalat](https://www.plantura.garden/gemuese/feldsalat/feldsalat-anbauen),
  [Pastinake](https://www.plantura.garden/gemuese/pastinaken/pastinaken-pflanzen),
  [Rucola](https://www.plantura.garden/gemuese/rucola/rucola-anbauen),
  [Basilikum](https://www.plantura.garden/kraeuter/basilikum/basilikum-pflanzen),
  [Oregano](https://www.plantura.garden/kraeuter/oregano/oregano-pflanzen),
  [Rosmarin](https://www.plantura.garden/kraeuter/rosmarin/rosmarin-pflanzen),
  [Thymian](https://www.plantura.garden/kraeuter/thymian/thymian-pflanzen),
  [Koriander](https://www.plantura.garden/kraeuter/koriander/koriander-pflanzen),
  [Schnittlauch](https://www.plantura.garden/kraeuter/schnittlauch/schnittlauch-pflanzen)

- Aussaat und Anzucht (T-50): [BZfE-Tabelle](https://www.landwirtschaft.de/fileadmin/SITE_MASTER/content/Downloads/Tabelle_Aussaat_und_Pflanzzeiten.pdf) (Anzucht, Pflanzung, Direktsaat), [meine ernte](https://www.meine-ernte.de/fileadmin/fieldupload/Aussaat-_und_Pflanzkalender.pdf) für offene Enden, dazu je Sorte der Plantura-Artikel zu Aussaat oder Anbau, z. B.
  [Tomaten säen](https://www.plantura.garden/gemuese/tomaten/tomaten-saeen),
  [Kohlrabi](https://www.plantura.garden/gemuese/kohlrabi/kohlrabi-pflanzen),
  [Salat](https://www.plantura.garden/gemuese/salat/salat-pflanzen),
  [Sellerie](https://www.plantura.garden/gemuese/sellerie/staudensellerie),
  [Thymian](https://www.plantura.garden/kraeuter/thymian/thymian-pflanzen).
  Wo Plantura keine Zahl nennt: [Kiepenkerl-Kulturanleitungen](https://www.kiepenkerl.de/kulturanleitungen/) (Keimdauer Paprika, Kohlrabi, Endivie, Möhre; Vorkultur Feldsalat; Keimtemperatur Möhre, Rote Bete), [Bingenheimer Saatgut](https://blog.bingenheimersaatgut.de/) (Keimung Zuckermais, Keimtemperatur Pastinake) und [Gartenjournal](https://www.gartenjournal.net/) (Keimung Lauch, Rosenkohl, Weißkohl, Schwarzwurzel; Keimtemperatur Bohnenkraut, Brokkoli; Keimdauer Petersilie ab 14 Tagen).

## Prüfprotokoll

T-46 (Oktober 2026) hat alle 56 Sorten gegen die Quellen geprüft: Familie gegen meine ernte, Bedarf gegen Plantura, Nachbarn gegen BUND und Plantura, Standzeit gegen die Kulturdauer von meine ernte. Unverändert, weil passend:

- **Familien:** alle. meine ernte nutzt ältere Namen (Gänsefuß-, Lilien-, Schmetterlingsblütler, Gräser); der Katalog bleibt bei Fuchsschwanz-, Lauch-, Hülsenfrüchtler und Süßgräsern.
- **Bedarf:** alle außer Basilikum.
- **Nachbarn mit BUND-Eintrag:** wie bisher.

Seit T-46 löst der Seed die Nachbarlisten symmetrisch auf. Dadurch zeigt jede Sorte auch die Paare, die nur die andere Seite nennt. Beispiel: Kopfsalat nennt Zuckermais; jetzt zeigt auch Zuckermais den Kopfsalat. Das ändert keine Warnung, denn die Regeln werten schon immer beide Seiten aus.

| Sorte | Feld | alt | neu | Quelle |
| --- | --- | --- | --- | --- |
| Basilikum | Bedarf | Stark | Mittel | Plantura Basilikum („mittelhoher Nährstoffbedarf“) gegen Plantura Zehrer-Liste (Stark): Entscheidung PO |
| Basilikum | Nachbarn | – / – | Tomate / Pfefferminze | Plantura Pflanzenkombinationen, Basilikum, Kräuter-Tabelle |
| Tomate | Gute Nachbarn | … | + Stangenbohne, Zwiebel, Basilikum | Plantura Mischkultur bei Tomaten |
| Tomate | Schlechte Nachbarn | Kartoffel, Fenchel, Erbse | + Salatgurke | Plantura Mischkultur bei Tomaten |
| Aubergine | Nachbarn | – / – | Blumenkohl, Brokkoli, Weißkohl, Rotkohl, Wirsing, Kopfsalat, Pflücksalat, Spinat / Tomate, Paprika, Chili, Zucchini, Kürbis | Plantura Aubergine („Kopfkohl“ = Weiß-, Rotkohl, Wirsing; Chili wie Paprika) |
| Feldsalat | Gute Nachbarn | – | Fenchel, Zwiebel, Erdbeere, Endivie, Kohl, Radieschen, Lauch, Buschbohne | Plantura Feldsalat |
| Pastinake | Nachbarn | – / – | Zwiebel, Knoblauch, Lauch, Kopfsalat, Pflücksalat, Radicchio, Mangold, Rote Bete, Bohnen, Erbse / Möhre, Petersilie, Fenchel, Sellerie | Plantura Pastinake („Salate“ = Kopf- und Pflücksalat, „Chicorée“ = Radicchio) |
| Rucola | Nachbarn | – / – | Kopfsalat, Pflücksalat, Sellerie, Zwiebel, Basilikum, Tomate / Spinat, Koriander, Erbse, Kohl, Kohlrabi, Chinakohl, Radieschen, Rettich | Plantura Rucola („alle Kreuzblütler“) |
| Bohnenkraut | Gute Nachbarn | – | Bohnen | Plantura Pflanzenkombinationen |
| Oregano | Nachbarn | – / – | Thymian, Basilikum, Salbei, Rosmarin, Schnittlauch / Pfefferminze | Plantura Oregano |
| Rosmarin | Gute Nachbarn | – | Basilikum, Oregano, Thymian, Salbei, Fenchel, Zwiebel, Lauch | Plantura Rosmarin, Kräuter-Tabelle |
| Thymian | Gute Nachbarn | – | Rosmarin, Salbei, Fenchel, Koriander | Plantura Thymian, Kräuter-Tabelle |
| Salbei | Gute Nachbarn | Fenchel | + Oregano, Bohnenkraut, Rosmarin, Thymian | Plantura Kräuter-Tabelle |
| Schnittlauch | Nachbarn | – / – | Erdbeere, Salatgurke, Schwarzwurzel, Rettich, Tomate, Dill, Petersilie, Thymian / Zwiebel, Frühlingszwiebel, Knoblauch, Lauch, Grünkohl, Kohlrabi, Radieschen | Plantura Schnittlauch (nur ausdrücklich genannte Kohlgewächse) |
| Koriander | Nachbarn | – / Dill | Salatgurke, Rote Bete, Basilikum / + Fenchel, Möhre, Sellerie | Plantura Koriander |
| Petersilie | Nachbarn | … / Kopfsalat | + Schnittlauch, Basilikum, Koriander / + Dill | Plantura Kräuter-Tabelle |
| Kapuzinerkresse | Gute Nachbarn | Stangenbohne, Radieschen, Rettich | + Zucchini, Salatgurke, Kürbis | Plantura Pflanzenkombinationen |
| Rote Bete | Standzeit | 14 Wo. | 20 Wo. | meine ernte: 130 Tage bis Erntebeginn: Entscheidung PO |
| Zwiebel | Standzeit | 18 Wo. | 22 Wo. | meine ernte: 140 Tage bis Erntebeginn: Entscheidung PO |
| Kartoffel | Standzeit | 16 Wo. | 18 Wo. | meine ernte: 120 Tage bis Erntebeginn: Entscheidung PO |

Strittige Werte und Entscheidungen des Product Owners:

- **Basilikum, Bedarf:** Plantura widerspricht sich (Zehrer-Liste Stark, Basilikum-Artikel mittel). Entscheidung: Mittel.
- **Tomate–Rotkohl:** BUND nennt Kohlgewächse als gute Nachbarn der Tomate, Plantura nennt Rotkohl schlecht, „die meisten Kohlarten“ aber gut. Entscheidung: bleibt gut.
- **Standzeiten** von Rote Bete, Zwiebel und Kartoffel lagen unter der Kulturdauer bis Erntebeginn. Entscheidung: anheben.
- **Chinakohl** hat nur einen schlechten Nachbarn (Rucola), keine Quelle nennt gute.

**Abstände** sind gegen die BZfE-Tabelle geprüft (aid-Heft 1559 „Von Apfel bis Zucchini“, Angabe Reihenabstand × Abstand in der Reihe) und stimmen bei allen Sorten. Das gilt auch für die in T-46 vermuteten Ausreißer: Stangenbohne 80 × 80 cm (6–8 Pflanzen je Stange), Kürbis 150 × 150 cm, Rhabarber 120 × 120 cm, Dill 30 × 30 cm und Radieschen 10 × 5 cm. Mehrere Sätze (früh, Sommer, Herbst) gibt die Tabelle u. a. für Kohl, Porree und Endivie an; der Katalog nutzt jeweils einen dieser Sätze, etwa Blumenkohl Sommer 60 × 60 cm und Rot-/Weißkohl Herbst 60 × 50 cm. Bewusst nach meine ernte statt BZfE bleiben Salatgurke (BZfE 150 × 40 cm, Katalog 100 × 40 cm), Zucchini (BZfE 2 m² je Pflanze, Katalog 100 × 100 cm) und Rucola (BZfE 15 × 0,5 cm, Katalog 20 × 3 cm).

### Aussaat und Anzucht (T-50, Oktober 2026)

**Standzeiten** sind gegen die BZfE-Tabelle geprüft: Bei allen vorgezogenen Sorten endet der Beginn der Pflanzung plus Standzeit im Erntezeitraum, z. B. Tomate KW 20 + 22 Wochen = KW 42 (Ernte bis Oktober), Rosenkohl KW 17 + 30 = November, Lauch KW 22 + 22 = Ende Oktober. Die Standzeiten enthalten also keine Vorkultur und bleiben unverändert. meine ernte zählt die Kulturdauer ebenfalls ab der Pflanzung.

Entscheidungen des Product Owners:

- **Pflanzgut:** Kartoffel, Knoblauch und Zwiebel gelten als Direktsaat (gelegt bzw. gesteckt); Erdbeere, Pfefferminze, Rhabarber und Rosmarin bekommen keine Aussaatangaben.
- **Knoblauch:** Herbststecken KW 40–46 nach Plantura („zwischen September und November“), weil die Standzeit von 38 Wochen zur Ernte im Juli des Folgejahres passt. BZfE nennt nur das Frühjahr (A. Mär–E. Apr).
- **Mehrere Sätze:** zusammenfassen, sonst der Satz, der zu Abstand und Standzeit passt.
- **Keimdaten und Vorkulturdauer:** wie oben beschrieben aus BZfE abgeleitet und mit Plantura ergänzt.

Zusammengefasste und ausgewählte Sätze der BZfE-Tabelle:

| Sorte | Fenster im Katalog | Weggelassen |
| --- | --- | --- |
| Blumenkohl | Sommer und Herbst | Winter-Blumenkohl (Anzucht M. Jun–A. Jul, Pflanzung A.–M. Aug, Ernte im Frühjahr) |
| Endivie | Sommer und Herbst | – |
| Fenchel | früher und später Satz | – |
| Kohlrabi | früh und spät | – |
| Lauch | Herbst und Winter (Abstand 40 × 15 cm) | Sommer-Lauch (Anzucht M. Jan–E. Feb); darauf beziehen sich die 5–6 Wochen Vorkultur bei Plantura |
| Rettich | Sommer und Winter | – |
| Rotkohl, Weißkohl | früh, Herbst und Lager | – |
| Wirsing | früh, Herbst und spät | – |
| Möhre | frühe | späte (A. Mai–A. Jul, Abstand 25 × 7 cm) |
| Spinat | Frühjahr | Herbst (A. Aug–M. Sep) |
| Schwarzwurzel | Frühjahr (Mär/Apr) | Herbstsaat im August (steht über ein Jahr im Beet) |
| Zwiebel | Steckzwiebeln (Mär–Apr) | Saatzwiebeln (Direktsaat A. Mär–A. Apr) |
| Frühlingszwiebel | Bund-Zwiebeln, Direktsaat | Pflanzung ab M. Apr |
| Pflücksalat | Blattsalate (Eichblatt, Krause, Lollo) | – |
| Staudensellerie | wie Knollensellerie (eine Zeile bei BZfE) | – |

Offene Enden und Ableitungen:

- **Chinakohl:** Anzucht „ab M. Apr“ endet in KW 29 = späteste Pflanzung (M. Aug) minus 4 Wochen Vorkultur.
- **Kürbis:** Vorkultur KW 16–17 nach Plantura („ab Mitte bis Ende April“), Direktsaat bis KW 25 nach meine ernte.
- **Zucchini:** Vorkultur bis KW 19 und Direktsaat bis KW 25 nach meine ernte.
- **Zuckermais:** Vorkultur KW 14–16 (BZfE „ab A. Apr“, Plantura „Mitte April“), Direktsaat bis KW 23 nach meine ernte.
- **Salatgurke:** Direktsaat bis KW 25 nach meine ernte.
- **Frühlingszwiebel:** Direktsaat bis KW 30 nach Plantura („zwischen März und Juli“).
- **Basilikum:** Pflanzung „ab M. Mai“; Vorkultur 4–9 Wochen aus Ende und Beginn der Anzucht bis Mitte Mai.
- **Chili:** nicht bei BZfE; Vorkultur KW 3–10 und 10–17 Wochen nach Plantura („zwischen Mitte Januar und Anfang März“, Pflanzung ab Mitte Mai).
- **Vorkulturdauer erweitert** um die Angabe bei Plantura: Tomate 7–13 (Plantura „2 bis 3 Monate“), Zuckermais 2–5 („zwei bis drei Wochen“), Oregano 9–13 („zwei bis drei Monate“).
- **Salbei** (4 Wochen) und **Schnittlauch** (5 Wochen): nur aus Beginn bzw. Ende der Fenster abgeleitet, weil die Pflanzzeit der BZfE auch gekaufte Pflanzen und Teilstücke umfasst.
- **Knollen- und Staudensellerie:** 5–12 Wochen aus der BZfE-Tabelle (A. Mär–E. Apr bis E. Mai); die 8 Wochen bei Plantura liegen darin.

Abweichungen zwischen BZfE und Plantura bei der Aussaat (es gilt BZfE):

- **Nur Direktsaat bei BZfE, Plantura nennt auch Vorkultur:** Buschbohne, Stangenbohne, Erbse, Salatgurke, Mangold, Rote Bete, Feldsalat, Frühlingszwiebel, Dill, Kapuzinerkresse, Koriander, Petersilie, Thymian.
- **Radicchio:** BZfE Direktsaat M. Jun–M. Jul, Plantura „grundsätzlich vorgezogen“.
- **Nur Vorkultur bei BZfE, Plantura nennt auch Direktsaat:** Brokkoli, Grünkohl, Rosenkohl, Rotkohl, Lauch, Endivie; bei Blumenkohl ausdrücklich „nicht empfohlen“.
- **Fenchel:** BZfE nennt beides, Plantura sieht Direktsaat „meist nur bei Gewürzfenchel“.
- **Zwiebel:** BZfE steckt ab März, Plantura „nicht vor Ende April“.
- **Rucola:** beide Direktsaat; Vorziehen laut Plantura möglich, aber nicht empfehlenswert.

Bewusst ohne Wert:

- **Keimdauer** von Blumenkohl, Brokkoli, Rotkohl, Wirsing, Chinakohl und Radieschen sowie die Keimtemperatur von Wirsing: Sie stehen nur in der Gartenjournal-Sammeltabelle.
- **Keimdauer Thymian:** Plantura nennt nur „innerhalb von 2 Wochen“.
- **Keimdaten** von Kartoffel, Knoblauch und Zwiebel, weil sie gelegt bzw. gesteckt werden.

Frost (Plantura): Oregano, Salbei und Thymian sind als Jungpflanzen frostempfindlich und kommen nach den Eisheiligen ins Freie; Rosmarin ist „in der Regel nicht winterhart“. Zwiebel bleibt nicht frostempfindlich, obwohl Plantura Steckzwiebeln „kälteempfindlich“ nennt, weil Saatzwiebeln schon im Februar gesät werden; Koriander („ein wenig kälteempfindlich“, Direktsaat ab Ende März) ebenso. Radicchio ist frostempfindlich, weil Jungpflanzen erst bei konstant über 17 °C ins Freie kommen.


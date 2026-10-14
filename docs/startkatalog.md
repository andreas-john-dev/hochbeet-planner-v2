# Startkatalog

Stand: 14. Oktober 2026 (geprüft in T-46, siehe [Prüfprotokoll](#prüfprotokoll))

Der Startkatalog umfasst 56 Sorten: 43 Gemüse, die Erdbeere als Obst und 12 Kräuter. Er ist die Quelle für `packages/catalog-seed`. Jeder User kann alle Werte für sich überschreiben.

- **Abstände** sind Endabstände im Freiland nach BZfE, sonst nach meine ernte. Im Hochbeet wird oft etwas enger gepflanzt.
- **Standzeit** sind geschätzte Wochen von Pflanzung oder Aussaat bis Ernteende, abgeleitet aus Kulturdauer und Erntezeitraum der Quellen. Im Seed wird daraus `lifecycle`: „N Wo.“ = `ANNUAL` mit `cultureWeeks: N`, „3 Jahre“ = `MULTI_YEAR` mit `years: 3`, „dauerhaft“ = `PERENNIAL`.
- **Bedarf** folgt Plantura und Hornbach. Kräuter ohne Einzelangabe gelten als Schwachzehrer, Chili übernimmt die Werte von Paprika. Basilikum ist Mittelzehrer (Entscheidung des Product Owners, siehe Prüfprotokoll).
- **Nachbarn** folgen der BUND-Mischkulturtabelle. Für Sorten und Kräuter, die BUND nicht führt, ergänzen Plantura-Artikel die Paare (siehe Quellen). Ein Paar steht nur bei der Sorte, deren Quelle es nennt; der Seed macht die Listen symmetrisch, sodass jede Sorte auch die Paare der anderen Seite zeigt. „–“ heißt, die Quelle der Sorte nennt nichts.
- **Kurzformen**, die der Seed auflöst:
  - Kohl = Blumenkohl, Brokkoli, Grünkohl, Rosenkohl, Rotkohl, Weißkohl, Wirsing (nicht Kohlrabi, Chinakohl)
  - andere Kohlarten = Kohl ohne die Sorte selbst
  - Sellerie = Knollensellerie, Staudensellerie
  - Bohnen = Buschbohne, Stangenbohne
  - „wie X“ = dieselben Nachbarlisten wie Sorte X
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

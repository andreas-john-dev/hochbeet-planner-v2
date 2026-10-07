# Startkatalog

Stand: 7. Oktober 2026

Der Startkatalog umfasst 56 Sorten: 43 Gemüse, die Erdbeere als Obst und 12 Kräuter. Er ist die Quelle für `packages/catalog-seed`. Jeder User kann alle Werte für sich überschreiben.

- **Abstände** sind Endabstände im Freiland nach BZfE, sonst nach meine ernte. Im Hochbeet wird oft etwas enger gepflanzt.
- **Standzeit** sind geschätzte Wochen von Pflanzung oder Aussaat bis Ernteende, abgeleitet aus Kulturdauer und Erntezeitraum der Quellen. Im Seed wird daraus `lifecycle`: „N Wo.“ = `ANNUAL` mit `cultureWeeks: N`, „3 Jahre“ = `MULTI_YEAR` mit `years: 3`, „dauerhaft“ = `PERENNIAL`.
- **Bedarf** folgt Plantura und Hornbach. Kräuter ohne Einzelangabe gelten als Schwachzehrer, Chili übernimmt die Werte von Paprika.
- **Nachbarn** folgen der BUND-Mischkulturtabelle; „–“ heißt, die Quelle nennt nichts.
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
| Aubergine | Gemüse | Nachtschattengewächse | Stark | 40 | 40 | 16 Wo. | – | – |
| Blumenkohl | Gemüse | Kreuzblütler | Stark | 60 | 60 | 14 Wo. | wie Brokkoli | wie Brokkoli |
| Brokkoli | Gemüse | Kreuzblütler | Stark | 50 | 50 | 12 Wo. | Tomate, Bohnen, Spinat, Sellerie, Kopfsalat, Pflücksalat, Salatgurke, Radieschen, Rettich, Mangold, Lauch, Erbse, Endivie, Rhabarber | andere Kohlarten, Zwiebel, Knoblauch, Kartoffel, Erdbeere |
| Buschbohne | Gemüse | Hülsenfrüchtler | Schwach | 7 | 45 | 12 Wo. | Tomate, Sellerie, Radieschen, Rettich, Rote Bete, Pflücksalat, Mangold, Salatgurke, Kopfsalat, Kohlrabi, Kohl, Kartoffel, Rhabarber | Zwiebel, Lauch, Knoblauch, Fenchel, Erbse |
| Chili | Gemüse | Nachtschattengewächse | Stark | 40 | 40 | 20 Wo. | wie Paprika | wie Paprika |
| Chinakohl | Gemüse | Kreuzblütler | Mittel | 30 | 40 | 10 Wo. | – | – |
| Endivie | Gemüse | Korbblütler | Mittel | 30 | 40 | 12 Wo. | Stangenbohne, Lauch, Kohl, Fenchel | Tomate, Buschbohne, Paprika, Kohlrabi |
| Erbse | Gemüse | Hülsenfrüchtler | Schwach | 4 | 40 | 12 Wo. | Radieschen, Rettich, Kopfsalat, Kohl, Kohlrabi, Fenchel, Dill, Möhre | Tomate, Bohnen, Lauch, Knoblauch, Kartoffel |
| Feldsalat | Gemüse | Baldriangewächse | Schwach | 2 | 15 | 14 Wo. | – | – |
| Fenchel | Gemüse | Doldenblütler | Mittel | 20 | 45 | 12 Wo. | Endivie, Radicchio, Salbei, Pflücksalat, Kopfsalat, Salatgurke, Erbse | Bohnen, Tomate |
| Frühlingszwiebel | Gemüse | Lauchgewächse | Schwach | 3 | 30 | 10 Wo. | wie Zwiebel | wie Zwiebel |
| Grünkohl | Gemüse | Kreuzblütler | Stark | 50 | 50 | 30 Wo. | wie Brokkoli | wie Brokkoli |
| Kartoffel | Gemüse | Nachtschattengewächse | Stark | 30 | 60 | 16 Wo. | Spinat, Pfefferminze, Kohlrabi, Dill, Buschbohne | Tomate, Sellerie, Erbse, Rote Bete, Kohl |
| Knoblauch | Gemüse | Lauchgewächse | Schwach | 15 | 20 | 38 Wo. | Tomate, Rote Bete, Salatgurke, Möhre, Erdbeere | Bohnen, Erbse, Kohl |
| Knollensellerie | Gemüse | Doldenblütler | Stark | 40 | 40 | 22 Wo. | Tomate, Stangenbohne, Spinat, Lauch, Kopfsalat, Kohlrabi, Kohl, Salatgurke, Buschbohne | Zuckermais, Kartoffel |
| Kohlrabi | Gemüse | Kreuzblütler | Mittel | 25 | 30 | 9 Wo. | Tomate, Bohnen, Spinat, Sellerie, Lauch, Kartoffel, Erbse, Schwarzwurzel, Rote Bete, Radieschen, Rettich, Kopfsalat | – |
| Kopfsalat | Gemüse | Korbblütler | Mittel | 25 | 30 | 8 Wo. | Zwiebel, Endivie, Radicchio, Tomate, Bohnen, Kohlrabi, Kohl, Schwarzwurzel, Rhabarber, Dill, Radieschen, Rettich, Salatgurke, Fenchel, Erdbeere, Erbse, Pfefferminze, Zuckermais, Lauch | Petersilie |
| Kürbis | Gemüse | Kürbisgewächse | Stark | 150 | 150 | 20 Wo. | Bohnen, Zuckermais, Kohlrabi, Erbse, Zwiebel | Salatgurke, Tomate |
| Lauch | Gemüse | Lauchgewächse | Stark | 15 | 40 | 22 Wo. | Tomate, Sellerie, Schwarzwurzel, Kopfsalat, Kohlrabi, Kohl, Möhre, Endivie, Erdbeere | Bohnen, Erbse, Rote Bete |
| Mangold | Gemüse | Fuchsschwanzgewächse | Mittel | 30 | 40 | 20 Wo. | Radieschen, Rettich, Kohl, Möhre, Buschbohne | – |
| Möhre | Gemüse | Doldenblütler | Mittel | 4 | 25 | 14 Wo. | Zwiebel, Endivie, Radicchio, Tomate, Schwarzwurzel, Erbse, Dill, Lauch, Knoblauch, Radieschen, Rettich, Mangold | – |
| Paprika | Gemüse | Nachtschattengewächse | Stark | 40 | 40 | 18 Wo. | Möhre, Zwiebel, Lauch, Salatgurke, Erdbeere | Fenchel |
| Pastinake | Gemüse | Doldenblütler | Mittel | 20 | 35 | 30 Wo. | – | – |
| Pflücksalat | Gemüse | Korbblütler | Mittel | 35 | 35 | 10 Wo. | Tomate, Schwarzwurzel, Rhabarber, Rote Bete, Radieschen, Rettich, Kohl, Fenchel, Dill, Buschbohne | – |
| Radicchio | Gemüse | Korbblütler | Mittel | 20 | 30 | 16 Wo. | Tomate, Stangenbohne, Kopfsalat, Möhre, Fenchel | – |
| Radieschen | Gemüse | Kreuzblütler | Schwach | 5 | 10 | 5 Wo. | Tomate, Bohnen, Spinat, Pflücksalat, Petersilie, Mangold, Kopfsalat, Kohl, Möhre, Kohlrabi, Kapuzinerkresse, Erdbeere, Erbse | Salatgurke |
| Rettich | Gemüse | Kreuzblütler | Mittel | 15 | 30 | 9 Wo. | wie Radieschen | wie Radieschen |
| Rhabarber | Gemüse | Knöterichgewächse | Stark | 120 | 120 | dauerhaft | Spinat, Pflücksalat, Kopfsalat, Kohl, Buschbohne | – |
| Rosenkohl | Gemüse | Kreuzblütler | Stark | 60 | 60 | 30 Wo. | wie Brokkoli | wie Brokkoli |
| Rote Bete | Gemüse | Fuchsschwanzgewächse | Mittel | 10 | 30 | 14 Wo. | Zwiebel, Pflücksalat, Kohlrabi, Knoblauch, Salatgurke, Erdbeere, Dill, Buschbohne | Zuckermais, Lauch, Kartoffel |
| Rotkohl | Gemüse | Kreuzblütler | Stark | 50 | 60 | 20 Wo. | wie Brokkoli | wie Brokkoli |
| Rucola | Gemüse | Kreuzblütler | Schwach | 3 | 20 | 6 Wo. | – | – |
| Salatgurke | Gemüse | Kürbisgewächse | Stark | 40 | 100 | 16 Wo. | Zwiebel, Bohnen, Sellerie, Rote Bete, Kopfsalat, Kohl, Knoblauch, Dill, Fenchel | Radieschen, Rettich |
| Schwarzwurzel | Gemüse | Korbblütler | Mittel | 10 | 25 | 30 Wo. | Zwiebel, Pflücksalat, Lauch, Kopfsalat, Kohlrabi, Möhre | – |
| Spinat | Gemüse | Fuchsschwanzgewächse | Mittel | 10 | 15 | 8 Wo. | Tomate, Stangenbohne, Sellerie, Rhabarber, Radieschen, Rettich, Kohlrabi, Kohl, Kartoffel, Erdbeere | Rote Bete, Mangold |
| Stangenbohne | Gemüse | Hülsenfrüchtler | Schwach | 80 | 80 | 16 Wo. | Zucchini, Endivie, Radicchio, Spinat, Sellerie, Radieschen, Rettich, Kopfsalat, Kohlrabi, Kohl, Kapuzinerkresse, Salatgurke | Zwiebel, Lauch, Knoblauch, Fenchel, Erbse |
| Staudensellerie | Gemüse | Doldenblütler | Stark | 40 | 40 | 18 Wo. | wie Knollensellerie | wie Knollensellerie |
| Tomate | Gemüse | Nachtschattengewächse | Stark | 60 | 60 | 22 Wo. | Radicchio, Spinat, Sellerie, Radieschen, Rettich, Pflücksalat, Pfefferminze, Petersilie, Kopfsalat, Kohlrabi, Kohl, Knoblauch, Möhre, Buschbohne, Lauch | Kartoffel, Fenchel, Erbse |
| Weißkohl | Gemüse | Kreuzblütler | Stark | 50 | 60 | 20 Wo. | wie Brokkoli | wie Brokkoli |
| Wirsing | Gemüse | Kreuzblütler | Stark | 50 | 50 | 18 Wo. | wie Brokkoli | wie Brokkoli |
| Zucchini | Gemüse | Kürbisgewächse | Stark | 100 | 100 | 18 Wo. | Zwiebel, Stangenbohne | – |
| Zuckermais | Gemüse | Süßgräser | Stark | 30 | 40 | 16 Wo. | Kopfsalat, Kürbis, Salatgurke, Kartoffel | Sellerie, Rote Bete, Tomate |
| Zwiebel | Gemüse | Lauchgewächse | Schwach | 10 | 25 | 18 Wo. | Zucchini, Schwarzwurzel, Rote Bete, Dill, Salatgurke, Kopfsalat, Möhre, Erdbeere | Bohnen, Kohl |
| Erdbeere | Obst | Rosengewächse | Mittel | 30 | 90 | 3 Jahre | Radieschen, Rettich, Rote Bete, Petersilie, Lauch, Knoblauch, Buschbohne, Kopfsalat, Zwiebel, Spinat | Kohl, Kartoffel, Tomate |
| Basilikum | Kraut | Lippenblütler | Stark | 25 | 25 | 16 Wo. | – | – |
| Bohnenkraut | Kraut | Lippenblütler | Schwach | 25 | 25 | 16 Wo. | – | – |
| Dill | Kraut | Doldenblütler | Schwach | 30 | 30 | 10 Wo. | Zwiebel, Rote Bete, Pflücksalat, Möhre, Salatgurke, Erbse, Kopfsalat | Fenchel, Koriander |
| Kapuzinerkresse | Kraut | Kapuzinerkressengewächse | Schwach | 10 | 20 | 20 Wo. | Stangenbohne, Radieschen, Rettich | – |
| Koriander | Kraut | Doldenblütler | Schwach | 15 | 30 | 10 Wo. | – | Dill |
| Oregano | Kraut | Lippenblütler | Schwach | 15 | 20 | dauerhaft | – | – |
| Petersilie | Kraut | Doldenblütler | Schwach | 5 | 20 | 30 Wo. | Tomate, Radieschen, Rettich, Erdbeere | Kopfsalat |
| Pfefferminze | Kraut | Lippenblütler | Schwach | 30 | 30 | dauerhaft | Tomate, Kopfsalat, Möhre, Kartoffel | – |
| Rosmarin | Kraut | Lippenblütler | Schwach | 50 | 50 | dauerhaft | – | – |
| Salbei | Kraut | Lippenblütler | Schwach | 40 | 30 | dauerhaft | Fenchel | – |
| Schnittlauch | Kraut | Lauchgewächse | Schwach | 20 | 25 | dauerhaft | – | – |
| Thymian | Kraut | Lippenblütler | Schwach | 20 | 20 | dauerhaft | – | – |

Bei der Stangenbohne bezeichnen 80 × 80 cm den Abstand der Stangen; an jeder Stange stehen 6–8 Pflanzen.

## Quellen

- [BZfE: Tabelle Aussaat und Pflanzzeiten](https://www.bzfe.de/fileadmin/resources/Bildung/Tabelle_Aussaat_und_Pflanzzeiten.pdf) – Abstände, Erntezeiträume
- [BUND: Mischkultur – gute und schlechte Nachbarn](https://www.bund.net/fileadmin/user_upload_bund/publikationen/naturnahes-gaertnern/Mischkultur-Gemuese-BUND.pdf) – Nachbarschaften
- [meine ernte: Aussaat- und Pflanzkalender](https://www.meine-ernte.de/fileadmin/fieldupload/Aussaat-_und_Pflanzkalender.pdf) – Pflanzenfamilien, Kulturdauer, Abstände für Zucchini, Gurke und Rucola
- [Plantura: Starkzehrer, Mittelzehrer & Schwachzehrer](https://www.plantura.garden/gemuese/gemuese-anbauen/starkzehrer-mittelzehrer-und-schwachzehrer) – Nährstoffbedarf
- [Hornbach: Mischkultur im Garten](https://www.hornbach.de/projekte/mischkultur-im-garten/) – Nährstoffbedarf für Salate und Rucola

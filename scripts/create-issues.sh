#!/usr/bin/env bash
# Legt Labels, Epics (User Stories) und alle Tasks als GitHub-Issues an.
#
# Nutzt ausschließlich die REST-API über `gh api` und funktioniert damit lokal
# und in Claude-Code-Cloud-Sessions (dort ist GraphQL eingeschränkt).
# Kompatibel mit macOS-Bash 3.2 (keine assoziativen Arrays).
#
# Aufruf im Repo-Root:   bash scripts/create-issues.sh
# Anderes Repo:          REPO=owner/name bash scripts/create-issues.sh
#
# Das Skript ist nicht idempotent und bricht ab, wenn es schon Issues mit Label "task" gibt.

set -euo pipefail

if [[ -z "${REPO:-}" ]]; then
  remote=$(git remote get-url origin)
  remote=${remote%.git}
  REPO=$(printf '%s\n' "$remote" | awk -F'[/:]' '{print $(NF-1)"/"$NF}')
fi
echo "Repository: $REPO"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

existing=$(gh api "repos/$REPO/issues?labels=task&state=all&per_page=1" --jq 'length')
if [[ "$existing" != "0" ]]; then
  echo "Im Repo gibt es bereits Issues mit Label 'task'. Abbruch, um Duplikate zu vermeiden." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------

label() {
  if gh api "repos/$REPO/labels" -f name="$1" -f color="$2" -f description="$3" >/dev/null 2>&1; then
    echo "Label angelegt: $1"
  else
    echo "Label vorhanden: $1"
  fi
}

# Body aus stdin in eine Datei schreiben: body <key> <<'EOF' ... EOF
body() { cat > "$TMP/$1.md"; }

# Platzhalter {{KEY}} durch #Issue-Nummer ersetzen; unbekannte Platzhalter als Text belassen
resolve() {
  local file="$TMP/$1.md" numfile key n
  for numfile in "$TMP"/num_*; do
    [[ -e "$numfile" ]] || continue
    key=${numfile##*/num_}
    n=$(cat "$numfile")
    perl -pi -e "s/\\{\\{\Q$key\E\\}\\}/#$n/g" "$file"
  done
  perl -pi -e 's/\{\{([A-Za-z0-9-]+)\}\}/$1/g' "$file"
}

create_issue() { # key title labels(kommagetrennt)
  local key=$1 title=$2 labels=$3 out l
  resolve "$key"
  local args=(-f "title=$title" -F "body=@$TMP/$key.md")
  IFS=',' read -r -a ls <<< "$labels"
  for l in "${ls[@]}"; do args+=(-f "labels[]=$l"); done
  out=$(gh api "repos/$REPO/issues" "${args[@]}" --jq '"\(.number) \(.id)"')
  echo "${out% *}" > "$TMP/num_$key"
  echo "${out#* }" > "$TMP/id_$key"
  echo "  #${out% *}  $title"
  sleep 1 # GitHub empfiehlt Pausen zwischen schreibenden Requests
}

epic() { # key title
  create_issue "$1" "$2" "epic"
  : > "$TMP/list_$1"
}

task() { # key epic labels title
  local key=$1 ep=$2 labels=$3 title=$4
  create_issue "$key" "$title" "task,$labels"
  echo "- [ ] #$(cat "$TMP/num_$key") $title" >> "$TMP/list_$ep"
  if ! gh api -X POST "repos/$REPO/issues/$(cat "$TMP/num_$ep")/sub_issues" \
      -F "sub_issue_id=$(cat "$TMP/id_$key")" >/dev/null 2>&1; then
    echo "      (Sub-Issue-Verknüpfung nicht möglich – Task-Liste im Epic reicht)"
  fi
}

finalize_epic() { # key
  local e=$1
  { cat "$TMP/$e.md"; printf '\n## Tasks\n\n'; cat "$TMP/list_$e"; } > "$TMP/${e}_final.md"
  gh api -X PATCH "repos/$REPO/issues/$(cat "$TMP/num_$e")" -F "body=@$TMP/${e}_final.md" >/dev/null
  echo "  Task-Liste ergänzt in #$(cat "$TMP/num_$e")"
}

# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

echo "Labels …"
label "epic"          "5319e7" "User Story mit Task-Liste"
label "task"          "0e8a16" "Umsetzbarer Task für Claude Code"
label "area:infra"    "1d76db" "CDK, CI/CD, AWS"
label "area:backend"  "fbca04" "Lambdas und DynamoDB"
label "area:frontend" "d93f0b" "React-App"
label "area:rules"    "c5def5" "Regel-Engine packages/garden-rules"

# ---------------------------------------------------------------------------
# Epics (User Stories)
# ---------------------------------------------------------------------------

echo "Epics …"

body E0 <<'EOF'
*Als Entwickler möchte ich ein lauffähiges, getestetes Gerüst mit Login und Hosting, damit jede weitere Funktion direkt in `prod` landen kann.*

Monorepo, CI, CDK-Grundgerüst mit Cognito, Frontend-Hosting, Login und Deployment-Pipeline.
EOF
epic E0 "Epic 0 – Fundament"

body E1 <<'EOF'
*Als Gärtner möchte ich gewarnt werden, wenn Abstand, Nachbarschaft, Starkzehrer oder Fruchtfolge nicht passen, damit mein Beet gesund wächst.*

Die Engine in `packages/garden-rules` ist reines TypeScript ohne AWS- oder React-Abhängigkeit. Sie bekommt die dichteste Testabdeckung im ganzen Projekt. Regeln: siehe `docs/architecture.md`, Abschnitt „Regel-Engine“.
EOF
epic E1 "Epic 1 – Regel-Engine"

body E2 <<'EOF'
*Als Gärtner möchte ich aus einem gepflegten Katalog wählen, ihn für mich anpassen und eigene Sorten anlegen, damit die Warnungen zu meinem Garten passen.*

Startkatalog als Seed, Pflanzen-Icons, Catalog-Stacks, Lesen, eigene Sorten, Anpassungen und Publikation.
EOF
epic E2 "Epic 2 – Catalog-Service"

body E3 <<'EOF'
*Als Gärtner möchte ich meine Beete und Pflanzungen sicher speichern, damit ich sie auf jedem Gerät wiederfinde.*
EOF
epic E3 "Epic 3 – Garden-Service"

body E4 <<'EOF'
*Als Gärtner möchte ich meine Beete maßstabsgetreu sehen und per Drag & Drop oder Antippen bepflanzen, damit ich Platz und Abstände realistisch plane.*
EOF
epic E4 "Epic 4 – Beet-Editor"

body E5 <<'EOF'
*Als Gärtner möchte ich mein Beet über die Saison planen und sofort sehen, was nicht zusammenpasst, damit ich Nachkulturen sinnvoll setze.*
EOF
epic E5 "Epic 5 – Zeit & Warnungen"

body E6 <<'EOF'
*Als Gärtner möchte ich Sorten nachschlagen, anpassen und eigene anlegen; als Admin möchte ich gute eigene Sorten für alle freigeben.*
EOF
epic E6 "Epic 6 – Katalog-UI & Admin"

body E7 <<'EOF'
*Als User möchte ich eine schnelle, schöne und fehlerarme App auf jedem Gerät.*
EOF
epic E7 "Epic 7 – Qualität & Feinschliff"

# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

echo "Tasks …"

# --- Epic 0 – Fundament ------------------------------------------------------

body T-01 <<'EOF'
Epic: {{E0}}

**Ziel:** Leeres, aber vollständig verdrahtetes Monorepo nach der Struktur in `docs/architecture.md`.

**Abhängig von:** –

### Umfang
- pnpm Workspaces, Turborepo, gemeinsame `tsconfig` (strict), ESLint und Prettier, Vitest-Workspace
- Ordner `apps/web`, `services/catalog`, `services/garden`, `packages/*`, `infra`, `e2e` mit je einem Platzhalter
- Befehle in `CLAUDE.md` an die tatsächlichen Skripte anpassen

### Akzeptanzkriterien
- [ ] `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm typecheck` und `pnpm test` laufen grün
- [ ] Jedes Paket hat mindestens einen Beispieltest
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-01 E0 "area:infra" "T-01 Monorepo-Gerüst"

body T-02 <<'EOF'
Epic: {{E0}}

**Ziel:** Jeder Pull Request wird automatisch geprüft.

**Abhängig von:** {{T-01}}

### Umfang
- GitHub Actions: Install mit Cache, Lint, Typecheck, Test, `cdk synth`
- Turborepo-Cache, damit nur geänderte Pakete laufen

### Akzeptanzkriterien
- [ ] Ein absichtlich kaputter Test lässt den Workflow fehlschlagen
- [ ] Laufzeit auf leerem Gerüst unter 5 Minuten
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-02 E0 "area:infra" "T-02 CI für Pull Requests"

body T-03 <<'EOF'
Epic: {{E0}}

**Ziel:** Cognito steht und ist für andere Stacks über SSM auffindbar.

**Abhängig von:** {{T-01}}

### Umfang
- Stage-Konfiguration `infra/lib/config/stages.ts` mit nur `prod`, Region `eu-central-1`
- `Prod-SharedStateful`: User Pool (E-Mail-Login, Selbstregistrierung), SPA-Client ohne Secret, Gruppe `admins`
- SSM-Parameter für UserPool-ID und Client-ID; `RETAIN` und Termination Protection

### Akzeptanzkriterien
- [ ] CDK-Assertion-Tests prüfen Pool, Client, Gruppe und SSM-Parameter
- [ ] `cdk-nag` (AwsSolutions) ohne ungeklärte Fehler; begründete Ausnahmen sind dokumentiert
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-03 E0 "area:infra" "T-03 CDK-App und Shared Stateful Stack"

body T-04 <<'EOF'
Epic: {{E0}}

**Ziel:** Eine moderne, responsive App-Shell, auf der alle Seiten aufbauen.

**Abhängig von:** {{T-01}}

### Umfang
- Vite, React, TypeScript, Tailwind, shadcn/ui, TanStack Router und Query, date-fns mit deutscher Locale
- Layout: Seitenleiste auf dem Desktop, untere Navigation auf dem Smartphone; Light- und Dark-Mode
- Seitengerüste: Beete, Katalog, Profil, Admin (nur Platzhalter)

### Akzeptanzkriterien
- [ ] Playwright-Screenshots der Shell in Desktop, iPhone und Pixel sind abgelegt
- [ ] Keine horizontale Scrollbar bei 375 px Breite
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-04 E0 "area:frontend" "T-04 Frontend-Gerüst"

body T-05 <<'EOF'
Epic: {{E0}}

**Ziel:** Die App ist unter der CloudFront-URL erreichbar.

**Abhängig von:** {{T-03}}, {{T-04}}

### Umfang
- `Prod-Frontend`: privater S3-Bucket mit OAC, CloudFront, SPA-Fallback auf `index.html`
- Build-Deployment per `BucketDeployment`, `config.json` mit UserPool-ID, Client-ID und Region aus SSM
- Vorbereitete Stelle für die API-Behaviors `/api/catalog/*` und `/api/garden/*`

### Akzeptanzkriterien
- [ ] Deep-Links wie `/beete/123` laden nach Reload korrekt
- [ ] `config.json` wird nicht gecacht, Assets mit Hash lange
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-05 E0 "area:infra,area:frontend" "T-05 Frontend-Stack und Hosting"

body T-06 <<'EOF'
Epic: {{E0}}

**Ziel:** User können sich registrieren, anmelden und abmelden.

**Abhängig von:** {{T-05}}

### Umfang
- `aws-amplify/auth` mit Konfiguration aus `config.json`
- Registrierung mit Bestätigungscode, Login, Logout, Passwort vergessen; deutsche Fehlermeldungen
- Geschützte Routen; Admin-Bereich nur für Gruppe `admins` sichtbar
- API-Client, der das ID-Token automatisch mitsendet

### Akzeptanzkriterien
- [ ] Playwright-Test: Login und Logout mit einem Testuser
- [ ] Ohne Login leitet jede geschützte Route auf die Anmeldung um
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-06 E0 "area:frontend" "T-06 Login mit Amplify"

body T-07 <<'EOF'
Epic: {{E0}}

**Ziel:** Jeder Merge auf `main` landet automatisch in `prod`.

**Abhängig von:** {{T-02}}, {{T-05}}

### Umfang
- GitHub Actions mit OIDC-Rolle; die einmalige Einrichtung von Rolle und `cdk bootstrap` ist in `docs/` beschrieben
- `cdk deploy --all`, danach Playwright-Smoke-Test gegen die CloudFront-URL

### Akzeptanzkriterien
- [ ] Keine AWS-Access-Keys im Repo oder in GitHub-Secrets
- [ ] Ein fehlgeschlagener Smoke-Test markiert den Workflow rot
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-07 E0 "area:infra" "T-07 Deployment-Pipeline"

# --- Epic 1 – Regel-Engine ---------------------------------------------------

body T-08 <<'EOF'
Epic: {{E1}}

**Ziel:** Gemeinsame Typen für Frontend und Backend.

**Abhängig von:** {{T-01}}

### Umfang
- Zod-Schemas in `packages/contracts`: Bed (inkl. `mainRowDirection`, `soilRenewals`), Planting (`SINGLE`/`ROW`), Plant mit Lebenszyklus und `icon`, Override, Publikationsstatus, API-Requests und -Responses
- Geometrie in `packages/garden-rules`: Standfläche (Kreis bzw. Streifen), Lücke zwischen zwei Standflächen, Rasterzellen einer Standfläche, Reihenrichtung

### Akzeptanzkriterien
- [ ] Unit-Tests für Lücke: Kreis–Kreis, Kreis–Streifen, Streifen–Streifen, überlappend (negativ)
- [ ] Reihen-Stückzahl = `floor(lengthCm / Pflanzabstand) + 1` ist getestet
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-08 E1 "area:rules" "T-08 Domänentypen, Schemas und Geometrie"

body T-09 <<'EOF'
Epic: {{E1}}

**Ziel:** Einheitliche Berechnung von Zeiträumen und Anzeige.

**Abhängig von:** {{T-08}}

### Umfang
- Effektives Ende: `removedDate` vor `endDate` vor Lebenszyklus; Dauerkulturen ohne Ende
- Zeitliche Überlappung zweier Pflanzungen, Filter auf eine Woche
- Saison: Liegt zwischen zwei Daten eine Erneuerung? Standard 1. März, wenn das Beet keinen Eintrag hat
- Formatierung: „30. März – 5. April 2026 · KW 14“ (ISO-8601)

### Akzeptanzkriterien
- [ ] Tests für Jahreswechsel, KW 53 und Knoblauch über den Winter
- [ ] Erdbeere endet nach genau 3 Jahren, Rosmarin nie
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-09 E1 "area:rules" "T-09 Zeitlogik"

body T-10 <<'EOF'
Epic: {{E1}}

**Ziel:** Warnung bei überlappenden Standflächen, Hinweis bei Überstand über den Beetrand.

**Abhängig von:** {{T-08}}, {{T-09}}

### Akzeptanzkriterien
- [ ] Nur zeitlich überlappende Pflanzungen werden geprüft
- [ ] Innerhalb einer Reihe entsteht keine Abstandswarnung
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-10 E1 "area:rules" "T-10 Regeln Pflanzabstand und Beetrand"

body T-11 <<'EOF'
Epic: {{E1}}

**Ziel:** Schlechte Nachbarn warnen, gute Nachbarn geben einen positiven Hinweis.

**Abhängig von:** {{T-10}}

### Umfang
- Einflussradius 30 cm als zentrale Konstante; Auswertung symmetrisch

### Akzeptanzkriterien
- [ ] „Warnung sticht“: Markiert eine Seite das Paar als schlecht, gibt es keinen positiven Hinweis
- [ ] Tests mit Tomate/Kartoffel (Warnung) und Tomate/Kopfsalat (Hinweis)
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-11 E1 "area:rules" "T-11 Regeln Nachbarschaft"

body T-12 <<'EOF'
Epic: {{E1}}

**Ziel:** Kein Starkzehrer quer zur Reihenrichtung neben einem anderen, solange weniger als 30 cm Lücke bleiben.

**Abhängig von:** {{T-10}}

### Umfang
- Reihenrichtung: Orientierung der Reihe, bei Einzelpflanzen die Reihenrichtung des Beets (`mainRowDirection`)
- Nebeneinander = Standflächen überschneiden sich entlang der Reihenrichtung; Kopfende = hintereinander
- Unterschiedlich ausgerichtete Reihen werden aus beiden Sichten geprüft

### Akzeptanzkriterien
- [ ] Test: 2 × 1 m Beet, Brokkoli-Reihe quer, Staudensellerie-Reihe daneben mit 20 cm Lücke → Warnung
- [ ] Test: drei Brokkoli hintereinander in einer Reihe → keine Warnung
- [ ] Test: Starkzehrer am Kopfende einer Reihe → keine Warnung
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-12 E1 "area:rules" "T-12 Regel Starkzehrer"

body T-13 <<'EOF'
Epic: {{E1}}

**Ziel:** Warnung, wenn der direkte Vorgänger auf einer Rasterzelle zur selben Familie gehört.

**Abhängig von:** {{T-09}}, {{T-10}}

### Umfang
- Prüfung pro 5-cm-Rasterzelle; nur wenn zwischen Vorgänger und Nachfolger keine Erneuerung der Erde liegt

### Akzeptanzkriterien
- [ ] Test: Radieschen, danach Kohlrabi am selben Platz → Warnung
- [ ] Test: Radieschen, Salat, Kohlrabi → keine Warnung (kein direkter Nachfolger)
- [ ] Test: Erneuerung dazwischen → keine Warnung
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-13 E1 "area:rules" "T-13 Regel Fruchtfolge"

body T-14 <<'EOF'
Epic: {{E1}}

**Ziel:** Ein Einstiegspunkt für alle Regeln.

**Abhängig von:** {{T-10}}, {{T-11}}, {{T-12}}, {{T-13}}

### Umfang
- `evaluateBed(bed, plantings, plants, { week? })` liefert Befunde mit Regel, Stufe, Pflanzungs-IDs, Zeitraum und deutschem Text

### Akzeptanzkriterien
- [ ] Property-Tests mit fast-check: Ergebnisse sind symmetrisch und unabhängig von der Reihenfolge der Pflanzungen
- [ ] 200 Pflanzungen in einem Beet werden in unter 50 ms ausgewertet
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-14 E1 "area:rules" "T-14 Engine-API und Property-Tests"

# --- Epic 2 – Catalog-Service ------------------------------------------------

body T-15 <<'EOF'
Epic: {{E2}}

**Ziel:** Die 56 Sorten aus `docs/startkatalog.md` als typisierte Daten.

**Abhängig von:** {{T-08}}

### Umfang
- Paket `packages/catalog-seed` mit stabilen IDs pro Sorte
- Kurzformen auflösen: Kohl, Sellerie, Bohnen, „andere Kohlarten“ und „wie X“ (Definition in `docs/startkatalog.md`)
- Kategorie, Familie, Bedarf, Abstände, Lebenszyklus und Farbe pro Sorte

### Akzeptanzkriterien
- [ ] Test: Jede Nachbar-Referenz zeigt auf eine existierende Sorte
- [ ] Test: Jede Sorte erfüllt das Zod-Schema aus {{T-08}}
- [ ] Widersprüche (gut auf einer, schlecht auf der anderen Seite) werden in einem Testreport aufgelistet
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-15 E2 "area:backend" "T-15 Startkatalog als Seed-Daten"

body T-16 <<'EOF'
Epic: {{E2}}

*Als Gärtner möchte ich jede Pflanze im Beet auf einen Blick an ihrem Icon erkennen.*

**Ziel:** Jede Sorte hat ein eigenes, sofort erkennbares SVG-Icon, das im Beet, in der Palette und im Katalog erscheint.

**Abhängig von:** {{T-15}}

### Umfang
- Paket `packages/plant-icons`: 56 handgezeichnete SVG-Icons, eines pro Sorte aus dem Startkatalog
- Einheitlicher Stil: `viewBox` 0 0 48 48, flache Formen ohne Verläufe, maximal drei Farben pro Icon, auch auf 24 px lesbar, in Light- und Dark-Mode gut sichtbar
- Feld `icon` an der Sorte; React-Komponente `<PlantIcon plantId size />`
- Fallback-Icons je Kategorie (Gemüse, Obst, Kraut) für eigene Sorten; beim Anlegen kann der User ein vorhandenes Icon wählen
- Galerie-Seite unter `/dev/icons`, die alle Icons in 24, 32 und 48 px zeigt

### Akzeptanzkriterien
- [ ] Für alle 56 Sorten existiert ein Icon; ein Test schlägt fehl, wenn eines fehlt
- [ ] Playwright-Screenshot der Galerie in Light- und Dark-Mode ist abgelegt
- [ ] Verwechselbare Paare (Radieschen/Rettich, Weiß-/Rotkohl/Wirsing, Knollen-/Staudensellerie) unterscheiden sich sichtbar in Form oder Farbe
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-16 E2 "area:frontend" "T-16 Pflanzen-Icons"

body T-17 <<'EOF'
Epic: {{E2}}

**Ziel:** Tabelle steht und enthält den Startkatalog.

**Abhängig von:** {{T-03}}, {{T-15}}

### Umfang
- `Prod-CatalogStateful`: DynamoDB on-demand, PITR, `RETAIN`, GSI für die Publikationswarteschlange
- Seed per Custom Resource; idempotent und aktualisiert globale Sorten bei Änderungen am Seed

### Akzeptanzkriterien
- [ ] CDK-Assertion-Tests für Tabelle, GSI und Custom Resource
- [ ] Zweimaliges Deployen erzeugt keine Duplikate
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-17 E2 "area:infra,area:backend" "T-17 Catalog Stateful Stack"

body T-18 <<'EOF'
Epic: {{E2}}

**Ziel:** `GET /catalog/plants` liefert die effektive Sicht des Users.

**Abhängig von:** {{T-17}}

### Umfang
- `Prod-CatalogStateless`: HTTP API mit Cognito-JWT-Authorizer, `NodejsFunction` mit Hono
- Middleware für User-Kontext aus dem Token, Fehlerbehandlung, strukturiertes Logging
- Effektive Sicht = global ⊕ Anpassungen ∪ eigene Sorten, mit Kennzeichnung `isOverridden` und `isCustom`
- CloudFront-Behavior `/api/catalog/*` im Frontend-Stack

### Akzeptanzkriterien
- [ ] Integrationstest gegen DynamoDB Local
- [ ] Ohne Token antwortet die API mit 401
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-18 E2 "area:backend,area:infra" "T-18 Catalog-Lambdalith und Lesen des Katalogs"

body T-19 <<'EOF'
Epic: {{E2}}

**Ziel:** User pflegen eigene Sorten und passen globale Sorten für sich an.

**Abhängig von:** {{T-18}}

### Umfang
- Endpunkte für eigene Sorten (anlegen, ändern, archivieren) und Anpassungen (speichern, zurücksetzen) laut `docs/architecture.md`
- Nachbarlisten globaler Sorten dürfen nur auf globale Sorten zeigen

### Akzeptanzkriterien
- [ ] Test: Anpassungen eines Users sind für andere User unsichtbar
- [ ] Test: Eine verwendete eigene Sorte wird archiviert, nicht gelöscht
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-19 E2 "area:backend" "T-19 Eigene Sorten und Anpassungen"

body T-20 <<'EOF'
Epic: {{E2}}

**Ziel:** Eigene Sorten können global werden.

**Abhängig von:** {{T-19}}

### Umfang
- Publikation anfragen, Warteschlange lesen, freigeben (optional mit Korrekturen), ablehnen mit Kommentar, globale Sorten pflegen
- `/admin/*` prüft den Claim `cognito:groups`

### Akzeptanzkriterien
- [ ] Test: Nach Freigabe behält die Sorte ihre ID und bestehende Pflanzungen funktionieren weiter
- [ ] Test: Ein Nicht-Admin bekommt auf `/admin/*` den Status 403
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-20 E2 "area:backend" "T-20 Publikation und Admin-Endpunkte"

# --- Epic 3 – Garden-Service -------------------------------------------------

body T-21 <<'EOF'
Epic: {{E3}}

**Ziel:** Beete lassen sich über die API anlegen, lesen, ändern und löschen.

**Abhängig von:** {{T-03}}, {{T-08}}, {{T-18}} (Muster für die Lambdalith)

### Umfang
- `Prod-GardenStateful` und `Prod-GardenStateless` nach dem Muster des Catalog-Service
- Endpunkte `/garden/beds` laut `docs/architecture.md`; Felder inklusive Reihenrichtung und Erneuerungsdaten
- CloudFront-Behavior `/api/garden/*`

### Akzeptanzkriterien
- [ ] Test: Ein User sieht nie die Beete eines anderen
- [ ] Test: Beet löschen entfernt auch alle Pflanzungen
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-21 E3 "area:backend,area:infra" "T-21 Garden-Stacks und Beete"

body T-22 <<'EOF'
Epic: {{E3}}

**Ziel:** Pflanzungen lassen sich speichern und ändern; die API prüft nur die Struktur.

**Abhängig von:** {{T-21}}

### Umfang
- Endpunkte `/garden/beds/{bedId}/plantings` laut `docs/architecture.md`
- Validierung: Raster-Vielfache von 5, Reihen mit Orientierung und Länge, Start vor Ende, Start und Entfernen jeweils ein Montag
- `GET /garden/beds/{bedId}` liefert Beet und alle Pflanzungen mit einer Query

### Akzeptanzkriterien
- [ ] Test: Eine Pflanzung außerhalb des Beets wird gespeichert (fachliche Warnungen blockieren nie)
- [ ] Test: x = 7 wird mit 400 und deutscher Fehlermeldung abgelehnt
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-22 E3 "area:backend" "T-22 Pflanzungen"

# --- Epic 4 – Beet-Editor ----------------------------------------------------

body T-23 <<'EOF'
Epic: {{E4}}

**Ziel:** Alle Beete auf einen Blick, mit Anlegen und Bearbeiten.

**Abhängig von:** {{T-06}}, {{T-21}}

### Umfang
- Kartenraster mit Mini-Vorschau jedes Beets (Stand der laufenden Woche)
- Dialog „Beet anlegen“: Name, Breite, Tiefe, Reihenrichtung (Standard parallel zur kürzeren Kante, als Skizze erklärt)
- Bearbeiten und Löschen mit Bestätigung; leerer Zustand mit Einladung zum ersten Beet

### Akzeptanzkriterien
- [ ] Playwright: Beet anlegen, umbenennen, löschen
- [ ] Screenshots in allen drei Viewports
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-23 E4 "area:frontend" "T-23 Beetübersicht"

body T-24 <<'EOF'
Epic: {{E4}}

**Ziel:** Das Beet erscheint maßstabsgetreu mit Raster, Zoom und Pan.

**Abhängig von:** {{T-16}}, {{T-22}}, {{T-23}}

### Umfang
- SVG in cm-Koordinaten; 5-cm-Raster, das je nach Zoom fein oder grob eingeblendet wird
- Pflanzungen als Icon plus halbtransparente Standfläche in der Farbe der Sorte; Reihen zeigen alle Icons der berechneten Stückzahl
- Zoom und Pan mit Mausrad und Ziehen bzw. Pinch und Wischen; „Auf Beet einpassen“
- Editor-State in Zustand; Speichern über TanStack Query mit optimistischen Updates

### Akzeptanzkriterien
- [ ] Jede Pflanzung ist ein DOM-Element mit `data-testid`
- [ ] Screenshot eines Beispielbeets (2 × 1 m, 8 Pflanzungen) in allen Viewports
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-24 E4 "area:frontend" "T-24 SVG-Editor-Grundlage"

body T-25 <<'EOF'
Epic: {{E4}}

**Ziel:** Sorten aus einer Palette ins Beet ziehen.

**Abhängig von:** {{T-24}}

### Umfang
- Seitenleiste mit Suche, Filter nach Kategorie und Icons
- Drag & Drop mit dnd-kit; Vorschau rastet auf 5 cm ein
- Umschalter Einzelpflanze oder Reihe; Reihe wird in Reihenrichtung des Beets vorbelegt und per Griff auf Länge gezogen
- Pflanzdatum = Montag der im Slider gewählten Woche (bis T-28: aktuelle Woche)

### Akzeptanzkriterien
- [ ] Playwright: Tomate als Einzelpflanze und Möhren als 1-m-Reihe platzieren und nach Reload wiederfinden
- [ ] Tastaturbedienung: Sorte wählen und mit Pfeiltasten platzieren
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-25 E4 "area:frontend" "T-25 Pflanzen hinzufügen (Desktop)"

body T-26 <<'EOF'
Epic: {{E4}}

**Ziel:** Verschieben, Länge ändern, Details pflegen, rückgängig machen.

**Abhängig von:** {{T-25}}

### Umfang
- Verschieben per Drag, Reihenlänge per Griff
- Detailpanel: Sorte, Zeitraum mit echten Daten, Ende anpassen, „Entfernen ab …“, Löschen
- Undo/Redo mit Strg+Z / Strg+Umschalt+Z und Buttons

### Akzeptanzkriterien
- [ ] Playwright: Pflanzung verschieben, rückgängig machen, wiederherstellen
- [ ] „Entfernen ab“ setzt das Datum auf den Montag der gewählten Woche
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-26 E4 "area:frontend" "T-26 Pflanzungen bearbeiten"

body T-27 <<'EOF'
Epic: {{E4}}

**Ziel:** Der Editor ist auf dem Smartphone gut bedienbar.

**Abhängig von:** {{T-26}}

### Umfang
- Tap-to-place: Sorte im Bottom-Sheet wählen, aufs Raster tippen, Vorschau bestätigen
- Verschieben per Long-Press (ca. 200 ms) und Ziehen, ohne mit Scrollen oder Pinch zu kollidieren
- Detailpanel als Bottom-Sheet; Touch-Ziele mindestens 44 px

### Akzeptanzkriterien
- [ ] Playwright mit iPhone- und Pixel-Emulation: Pflanze per Tap setzen und per Long-Press verschieben
- [ ] Kein ungewolltes Zoomen der Seite beim Doppeltippen
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-27 E4 "area:frontend" "T-27 Mobile Bedienung"

# --- Epic 5 – Zeit & Warnungen -----------------------------------------------

body T-28 <<'EOF'
Epic: {{E5}}

**Ziel:** Das Beet zeigt den Stand einer wählbaren Woche.

**Abhängig von:** {{T-09}}, {{T-26}}

### Umfang
- Slider über dem Beet, beschriftet mit Monatsnamen; daneben „30. März – 5. April 2026 · KW 14“
- Vorgänger und Nachfolger an derselben Stelle erscheinen als blasse „Geister“
- Neue Pflanzungen starten in der gewählten Woche; Buttons „Heute“ und Woche vor/zurück

### Akzeptanzkriterien
- [ ] Playwright: Salat im April und Tomate im Mai an derselben Stelle; der Slider zeigt jeweils die richtige Pflanze
- [ ] Dauerkulturen bleiben in jeder späteren Woche sichtbar
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-28 E5 "area:frontend" "T-28 Wochen-Slider und Zeitachse"

body T-29 <<'EOF'
Epic: {{E5}}

**Ziel:** Warnungen und gute Nachbarn sind live sichtbar.

**Abhängig von:** {{T-14}}, {{T-28}}

### Umfang
- `evaluateBed` läuft bei jeder Änderung und beim Ziehen für die Vorschau
- Markierung am Objekt: rot für Warnung, dezent für Beetrand, grün für gute Nachbarn; Farbe immer mit Symbol kombiniert
- Warnungsliste mit deutschem Text; Klick hebt die betroffenen Pflanzungen hervor und springt zur Woche
- Warnungen der gesamten Saison als Zähler am Beet in der Übersicht

### Akzeptanzkriterien
- [ ] Playwright: Kartoffel neben Tomate erzeugt eine Warnung schon beim Ziehen
- [ ] Speichern bleibt trotz Warnung möglich
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-29 E5 "area:frontend" "T-29 Warnungen im Editor"

body T-30 <<'EOF'
Epic: {{E5}}

**Ziel:** User pflegen „Erde erneuert am …“ pro Beet.

**Abhängig von:** {{T-29}}

### Umfang
- Liste der Erneuerungen in den Beet-Einstellungen; Standard 1. März ist sichtbar und überschreibbar
- Erneuerungen erscheinen als Markierung auf dem Wochen-Slider

### Akzeptanzkriterien
- [ ] Playwright: Erneuerung zwischen zwei Kreuzblütlern entfernt die Fruchtfolge-Warnung
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-30 E5 "area:frontend" "T-30 Saisongrenze im UI"

# --- Epic 6 – Katalog-UI & Admin ---------------------------------------------

body T-31 <<'EOF'
Epic: {{E6}}

**Ziel:** Sorten durchsuchen und für sich anpassen.

**Abhängig von:** {{T-16}}, {{T-19}}

### Umfang
- Liste mit Icon, Suche und Filtern (Kategorie, Familie, Bedarf)
- Detailseite mit allen Werten und den Nachbarn als klickbare Chips
- „Für mich anpassen“ bearbeitet ein Overlay; angepasste Werte sind markiert, „Zurücksetzen“ stellt den globalen Stand her

### Akzeptanzkriterien
- [ ] Playwright: Pflanzabstand von Salat ändern, Warnung im Editor ändert sich entsprechend, zurücksetzen
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-31 E6 "area:frontend" "T-31 Katalogansicht und Anpassungen"

body T-32 <<'EOF'
Epic: {{E6}}

**Ziel:** User legen eigene Sorten an und fragen die Publikation an.

**Abhängig von:** {{T-20}}, {{T-31}}

### Umfang
- Formular mit allen Feldern, Icon-Auswahl aus `packages/plant-icons` oder Kategorie-Fallback
- Nachbarn per Suche auswählen; Lebenszyklus mit verständlicher Erklärung
- „Für alle vorschlagen“ und Statusanzeige (privat, angefragt, veröffentlicht, abgelehnt mit Kommentar)

### Akzeptanzkriterien
- [ ] Playwright: eigene Sorte anlegen, im Beet verwenden, Publikation anfragen
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-32 E6 "area:frontend" "T-32 Eigene Sorten und Publikation"

body T-33 <<'EOF'
Epic: {{E6}}

**Ziel:** Admins pflegen den globalen Katalog und die Warteschlange.

**Abhängig von:** {{T-32}}

### Umfang
- Warteschlange mit Vergleich zu ähnlichen globalen Sorten; vor Freigabe editierbar
- Freigeben oder ablehnen mit Kommentar; globale Sorten anlegen und ändern

### Akzeptanzkriterien
- [ ] Playwright mit Admin-Testuser: Anfrage freigeben; die Sorte erscheint danach für einen zweiten User
- [ ] Ein Nicht-Admin sieht den Bereich nicht und bekommt beim direkten Aufruf eine 403-Seite
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-33 E6 "area:frontend" "T-33 Admin-Bereich"

# --- Epic 7 – Qualität & Feinschliff -----------------------------------------

body T-34 <<'EOF'
Epic: {{E7}}

**Ziel:** Kernabläufe sind automatisch abgesichert.

**Abhängig von:** {{T-33}}

### Umfang
- Playwright-Projekte Desktop-Chrome, iPhone und Pixel; Login-Status per `storageState`
- Abläufe: Registrierung, Beet anlegen, Pflanzen setzen, Warnung sehen, Zeitachse, eigene Sorte, Admin-Freigabe
- `toHaveScreenshot` für Editor, Übersicht und Katalog in Light- und Dark-Mode
- Lokal gegen den Dev-Server mit MSW, nach jedem Deploy als Smoke-Suite gegen `prod`

### Akzeptanzkriterien
- [ ] Suite läuft im PR in unter 10 Minuten
- [ ] Testdaten werden nach jedem Lauf aufgeräumt
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-34 E7 "area:frontend,area:infra" "T-34 E2E-Suite und Visual Regression"

body T-35 <<'EOF'
Epic: {{E7}}

**Ziel:** Die App wirkt durchgehend hochwertig und ist zugänglich.

**Abhängig von:** {{T-34}}

### Umfang
- Leere Zustände, Lade-Skelette, verständliche deutsche Fehlermeldungen, sanfte Übergänge
- Kontraste nach WCAG AA, sichtbarer Fokus, Editor vollständig per Tastatur bedienbar
- Lighthouse-Lauf für Performance und Accessibility

### Akzeptanzkriterien
- [ ] Lighthouse mobil: Performance und Accessibility jeweils mindestens 90
- [ ] Kein Element verlässt bei 375 px Breite den Viewport
- [ ] Definition of Done aus `CLAUDE.md` erfüllt
EOF
task T-35 E7 "area:frontend" "T-35 Design-Feinschliff und Barrierefreiheit"

# ---------------------------------------------------------------------------
# Task-Listen in die Epics schreiben
# ---------------------------------------------------------------------------

echo "Epics vervollständigen …"
for e in E0 E1 E2 E3 E4 E5 E6 E7; do
  finalize_epic "$e"
done

cat <<EOF

Fertig: 8 Epics und 35 Tasks in $REPO angelegt.

Nächste Schritte (manuell, nicht per Skript möglich):
  1. In GitHub ein Project (Board) anlegen und die Issues mit Label "epic" und "task" hinzufügen.
  2. Mit Issue für T-01 starten: "Setze Issue #$(cat "$TMP/num_T-01") um."
EOF

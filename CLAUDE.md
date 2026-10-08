# Hochbeet-Planer – Hinweise für Claude Code

Web-App zum Planen von Hochbeeten mit Warnungen zu Pflanzabstand, Nachbarschaft, Starkzehrern und Fruchtfolge.
TypeScript-Monorepo: React-Frontend, serverless AWS-Backend, CDK.

## Referenzen

- `docs/architecture.md` – Architektur, Domänenmodell, Regeln, API, Stacks. **Verbindlich.**
- `docs/startkatalog.md` – 56 Sorten mit Abständen, Familie, Bedarf, Standzeit und Nachbarn; Quelle für `packages/catalog-seed`.
- GitHub-Issues – alle Aufgaben. Label `task` = umsetzbarer Task (T-01 … T-35), Label `epic` = User Story mit Task-Liste.

## Arbeitsweise

1. Arbeite immer genau ein Issue ab. Lies es zuerst vollständig, inklusive „Abhängig von“.
   In Cloud-Sessions die eingebauten GitHub-Tools oder REST nutzen: `gh api repos/{owner}/{repo}/issues/{N}`.
   `gh issue view` und andere GraphQL-Befehle können dort blockiert sein.
2. Prüfe, ob alle Abhängigkeiten geschlossen sind. Wenn nicht: melden statt anfangen.
3. Plane kurz, implementiere dann mit Tests.
4. Branch: `t-<nr>-<kurzname>`, z. B. `t-12-starkzehrer`.
   PR-Titel: `T-12: Regel Starkzehrer`. PR-Beschreibung enthält `Closes #<issue>` und die abgehakten Akzeptanzkriterien.
5. Weicht die Umsetzung von `docs/architecture.md` ab, aktualisiere das Dokument im selben PR und begründe es in der PR-Beschreibung.
6. Ist etwas fachlich unklar, frag nach, statt zu raten.

## Definition of Done

- `pnpm lint`, `pnpm typecheck` und `pnpm test` laufen grün.
- Neue Logik ist durch Tests abgedeckt, UI-Änderungen durch mindestens einen Playwright-Test.
- Infrastruktur: `cdk synth` ohne `cdk-nag`-Fehler, CDK-Assertion-Tests für neue Ressourcen.
- Alle Akzeptanzkriterien des Issues sind erfüllt.
- Diese Datei ist aktualisiert, falls sich Befehle oder Konventionen geändert haben.

## Befehle

Node 22, pnpm 10 (über `packageManager` in `package.json`). Alle Root-Befehle laufen über Turborepo.

```bash
pnpm install
pnpm build                       # Builds (aktuell nur apps/web via Vite)
pnpm lint                        # ESLint (Flat Config aus packages/eslint-config)
pnpm typecheck                   # tsc --noEmit je Paket
pnpm test                        # Unit- und Integrationstests (Vitest), ohne e2e
pnpm synth                       # cdk synth inkl. cdk-nag über Turborepo; baut apps/web vorher (läuft auch in der CI)
pnpm format                      # Prettier schreiben; pnpm format:check prüft nur
pnpm exec vitest                 # Alle Vitest-Projekte in einem Prozess (Watch-Modus)
pnpm --filter web dev            # Frontend lokal
pnpm --filter e2e test           # Playwright; startet den Vite-Dev-Server selbst
pnpm --filter e2e test --update-snapshots   # Screenshot-Baselines neu erzeugen (Diff vorher ansehen)
pnpm --filter e2e screenshots    # Ganzseiten-Screenshots aller Seiten nach e2e/screenshots-out/
SMOKE_BASE_URL=https://… pnpm --filter e2e smoke   # Smoke-Tests gegen eine deployte Stage (nur lesend)
pnpm --filter infra cdk synth    # CDK-CLI direkt, z. B. auch `cdk diff` oder `cdk ls`
```

Paketnamen für `--filter`: `web`, `infra`, `e2e`, `@hochbeet/<paket>` für `packages/*`,
`@hochbeet/catalog-service` und `@hochbeet/garden-service`.
Interne Pakete exportieren ihren TypeScript-Quelltext direkt (`exports` → `src/index.ts`) und brauchen keinen eigenen Build.
Deployment: `deploy.yml` deployt jeden grünen `main`-Commit per OIDC nach `prod` und führt danach die Smoke-Tests aus;
einmalige Einrichtung und Fehlersuche in `docs/deployment.md`.
Die CI (`.github/workflows/ci.yml`) führt bei jedem PR und auf `main` format:check, lint, typecheck, test, build und synth aus;
der Turborepo-Cache liegt in `.turbo` und wird per `actions/cache` geteilt.
Frontend (`apps/web`): Routen code-basiert in `src/router.tsx` (deutsche Pfade `/beete`, `/katalog`, `/profil`, `/admin`),
Seiten in `src/routes/`, shadcn/ui-Komponenten in `src/components/ui/` (Konfiguration `components.json`), Import-Alias `@/` → `src/`.
Farbschema über `useTheme()` aus `src/lib/theme.ts`; Wochenlabels über `formatWeek()` aus `@hochbeet/garden-rules`.
Anmeldung über `useAuth()` aus `src/lib/auth/context.ts`; API-Aufrufe nur über `createApiClient()` aus `src/lib/api.ts` (sendet das ID-Token).
Dev-Server und Playwright nutzen Mock-Auth (`apps/web/config.dev.json`): `test@example.com` bzw. `admin@example.com`, Passwort `Gemuese1!`, Code `123456`.
In Playwright-Tests mit `signInAs(page, 'user' | 'admin')` aus `e2e/tests/fixtures.ts` angemeldet starten; Seiten in `e2e/tests/pages.ts` haben ein `access`-Feld.
Neue Seiten in `e2e/tests/pages.ts` eintragen (mit `access`): Tests und PR-Screenshots nutzen diese Liste.
Der Workflow `screenshots.yml` kommentiert in jedem PR mit Frontend-Änderungen Desktop- und Mobil-Screenshots der geänderten Seiten
(Vergleich mit `main`); die Bilder liegen im Branch `screenshots`, der nie gemergt wird.
Playwright-Projekte: `desktop-chrome`, `iphone` (iPhone-Viewport mit Chromium), `pixel`; die Uhr ist in `e2e/tests/fixtures.ts` auf den 7. Oktober 2026 fixiert.
TypeScript bleibt vorerst auf 6.0, weil typescript-eslint TypeScript 7 noch nicht unterstützt.
Vor Änderungen an `turbo.json` oder Turborepo-Befehlen die zur installierten Version passende Doku in `node_modules/turbo/docs/` lesen.

## Konventionen

- TypeScript strict, kein `any`. Zod-Schemas in `packages/contracts` sind die einzige Quelle für API-Typen.
- `packages/garden-rules` ist reines TypeScript ohne AWS- oder React-Abhängigkeiten; Typen kommen aus `packages/contracts` (`import type`).
- Neue Regeln in `packages/garden-rules/src/rules/` als `(ctx: RuleContext) => Finding[]` und in `src/engine.ts` eintragen; Testdaten mit den Buildern aus `src/test-utils.ts`. Einstiegspunkt für App und Services ist nur `evaluateBed()`. Der Performance-Test (200 Pflanzungen < 50 ms) muss grün bleiben.
- `packages/catalog-seed`: Sorten in `src/data.ts` mit fester ULID, die nie geändert wird; Kurzformen der Nachbarlisten löst `resolveSeed()` auf. Ändert sich der Widerspruchsreport, mit `pnpm --filter @hochbeet/catalog-seed test -u` neu schreiben. Beim Deploy spielt `Custom::CatalogSeed` geänderte Sorten automatisch ein (Handler in `services/catalog/src/seed/`).
- `packages/plant-icons`: ein Icon pro Sorte in `src/icons/*.ts` (48 × 48, flach, höchstens drei Farben); neue Sorten brauchen ein Icon, sonst schlägt der Test fehl. In der App `<PlantIcon plant={…} />` aus `@hochbeet/plant-icons/react`; Galerie unter `/dev/icons`.
- `packages/contracts`: Grundtypen in `primitives.ts`, Domäne in `domain.ts`, Requests/Responses je Service in `api/`. Typen immer per `z.infer` aus den Schemas ableiten, nie doppelt schreiben.
- Längen immer in cm, Positionen auf dem 5-cm-Raster. Daten als ISO-Strings, Wochen nach ISO-8601, Rechnen mit date-fns (Locale `de`).
- Die `userId` kommt im Backend ausschließlich aus dem `sub`-Claim des JWT.
- Warnungen werden nie gespeichert und blockieren nie das Speichern.
- UI-Texte und Fehlermeldungen auf Deutsch; Code, Bezeichner, Kommentare und Commits auf Englisch (Conventional Commits).
- Region `eu-central-1`, Stage-Konfiguration in `infra/lib/config/stages.ts` (zunächst nur `prod`).
- Werte zwischen Stacks über SSM-Parameter; Namen nur in `infra/lib/config/ssm.ts` definieren.
- cdk-nag 3: Ausnahmen per `Validations.of(construct).acknowledge({ id, reason })` (nicht `NagSuppressions`) und in `docs/architecture.md` unter „cdk-nag“ eintragen.

## Was nicht aus Sessions passiert

- Kein `cdk deploy` aus einer Entwickler- oder Claude-Code-Session. Deployt wird nur über GitHub Actions nach dem Merge auf `main` (OIDC-Rolle).
- Keine AWS-Zugangsdaten, Tokens oder `.env`-Dateien mit Secrets ins Repo.
- Playwright gegen `prod` läuft in der Pipeline; in Sessions gegen den Dev-Server mit MSW.

## Prompt-Vorlage

```text
Setze Issue #<N> um. Halte dich an CLAUDE.md und docs/architecture.md.
Plane zuerst, implementiere mit Tests, führe lint, typecheck und test aus
und öffne einen PR mit "Closes #<N>".
```

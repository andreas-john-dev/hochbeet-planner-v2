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

Werden in T-01 angelegt; danach hier aktuell halten.

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test                        # Unit- und Integrationstests (Vitest)
pnpm --filter web dev            # Frontend lokal
pnpm --filter e2e test           # Playwright
pnpm --filter infra cdk synth    # CDK synthetisieren
```

## Konventionen

- TypeScript strict, kein `any`. Zod-Schemas in `packages/contracts` sind die einzige Quelle für API-Typen.
- `packages/garden-rules` ist reines TypeScript ohne AWS- oder React-Abhängigkeiten.
- Längen immer in cm, Positionen auf dem 5-cm-Raster. Daten als ISO-Strings, Wochen nach ISO-8601, Rechnen mit date-fns (Locale `de`).
- Die `userId` kommt im Backend ausschließlich aus dem `sub`-Claim des JWT.
- Warnungen werden nie gespeichert und blockieren nie das Speichern.
- UI-Texte und Fehlermeldungen auf Deutsch; Code, Bezeichner, Kommentare und Commits auf Englisch (Conventional Commits).
- Region `eu-central-1`, Stage-Konfiguration in `infra/lib/config/stages.ts` (zunächst nur `prod`).

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

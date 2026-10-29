# Hochbeet-Planer

Web-App zum Planen von Hochbeeten: Beete maßstabsgetreu anlegen, Pflanzungen über die Wochen einer Saison setzen und dabei Warnungen zu Pflanzabstand, Nachbarschaft, Starkzehrern und Fruchtfolge sehen. Warnungen blockieren nie das Speichern.

Live unter https://hochbeet.andi-john-dev.de

## Funktionen

- **Beet-Editor** mit Zeitachse: Einzelpflanzen und Reihen per Drag & Drop oder Tastatur, Zoom und Gesten auf dem Smartphone, Undo/Redo.
- **Regel-Engine** im Browser: Abstand, gute und schlechte Nachbarn, Starkzehrer quer zur Reihe, Fruchtfolge über Saisongrenzen.
- **Pflanzenkatalog** mit 56 Sorten im Startkatalog, persönlichen Anpassungen und eigenen Sorten, die ein Admin für alle veröffentlichen kann.
- **Anzucht**: Chargen von der Aussaat bis ins Beet mit Phase, Bestand und dem, was davon schon in Beeten verplant ist.
- **Gastmodus** ohne Konto; die Daten lassen sich nach der Anmeldung übernehmen.
- **Beet-Assistent** (für die Gruppe der Tester): erklärt Warnungen und macht geprüfte Pflanzvorschläge, auf Bedrock AgentCore mit festen Kostengrenzen.

## Technik

| Bereich | Stack |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Router und Query, Zustand |
| Backend | AWS Lambda (Node.js 22, Hono), API Gateway HTTP API, DynamoDB, Cognito |
| Assistent | Python 3.13, Strands Agents, Bedrock AgentCore (Runtime, Gateway, Memory), Claude Haiku 4.5 |
| Infrastruktur | AWS CDK (TypeScript), CloudFront, S3, Route 53; Deploy per GitHub Actions |
| Tests | Vitest, fast-check, Testcontainers (DynamoDB Local), CDK Assertions mit cdk-nag, Playwright, Lighthouse, pytest |

Monorepo mit pnpm Workspaces und Turborepo:

```
apps/web                 React-SPA
services/                catalog, garden (Lambdaliths), assistant-tools (Gateway-Tools)
agents/bed-assistant     Python-Agent des Beet-Assistenten
packages/                contracts (Zod-Schemas), garden-rules (Regel-Engine), catalog-seed,
                         plant-icons, service-kit, tsconfig, eslint-config
infra/                   CDK-App
e2e/                     Playwright-Tests und Smoke-Tests gegen prod
docs/                    Architektur, Deployment, Startkatalog, Modellvergleich
```

## Loslegen

Voraussetzungen: Node 22, pnpm 10 (über `corepack enable`), für den Agenten [uv](https://docs.astral.sh/uv/) und für Integrationstests Docker.

```bash
pnpm install
pnpm --filter web dev
```

Der Dev-Server läuft mit Mock-Anmeldung und Mock-API im Browser, ohne AWS. Anmelden mit `test@example.com` oder `admin@example.com`, Passwort `Gemuese1!`, Bestätigungscode `123456`.

## Befehle

```bash
pnpm lint            # ESLint, ruff
pnpm typecheck       # tsc, mypy
pnpm test            # Vitest und pytest (ohne e2e); Service-Integrationstests brauchen Docker
pnpm build           # Frontend und Code-Paket des Agenten
pnpm synth           # cdk synth mit cdk-nag
pnpm format          # Prettier

pnpm --filter e2e test:docker   # Playwright im offiziellen Image, wie in der CI
pnpm --filter e2e lighthouse    # Lighthouse mobil gegen den Produktions-Build
```

Weitere Befehle und alle Konventionen stehen in [`CLAUDE.md`](./CLAUDE.md).

## Deployment

Jeder grüne Commit auf `main` wird per GitHub Actions (OIDC) nach `prod` deployt; danach laufen Smoke-Tests gegen die App. Einmalige Einrichtung, Betrieb und Fehlersuche: [`docs/deployment.md`](./docs/deployment.md).

## Dokumentation

- [`docs/architecture.md`](./docs/architecture.md) – Überblick über Architektur und Grundregeln, Details je Thema in [`docs/architecture/`](./docs/architecture/)
- [`docs/deployment.md`](./docs/deployment.md) – Einrichtung, Betrieb, Fehlersuche
- [`docs/startkatalog.md`](./docs/startkatalog.md) – die Sorten des Startkatalogs mit Quellen
- [`docs/assistant-evaluation.md`](./docs/assistant-evaluation.md) – Modellvergleich des Beet-Assistenten

## Mitarbeit

Aufgaben liegen als GitHub-Issues vor (Label `task`, Epics mit Label `epic`). Pro Issue ein PR mit `Closes #<nr>` und den abgehakten Akzeptanzkriterien; CI (Lint, Typecheck, Tests, Synth, Playwright, Lighthouse) muss grün sein. Die Arbeitsweise und Definition of Done stehen in [`CLAUDE.md`](./CLAUDE.md).

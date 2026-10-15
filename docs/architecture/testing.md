# Testing und CI/CD

Teil der [Architektur](../architecture.md). Teststrategie, Playwright, Pipeline und Deploy.

Die Regel-Engine bekommt die dichteste Testabdeckung, weil dort die Fachlogik liegt. UI-Fehler und schlechtes Design sollen über Playwright-Screenshots sichtbar werden.

| Teil | Werkzeuge | Schwerpunkt |
| --- | --- | --- |
| `garden-rules` | Vitest, fast-check | Jede Regel mit Grenzfällen; Property-Tests, z. B. „Warnungen sind symmetrisch“ |
| Services | Vitest, `aws-sdk-client-mock`, DynamoDB Local via Testcontainers | Routen, Validierung, Autorisierung, Schlüsseldesign |
| IaC | CDK Assertions, Snapshots, `cdk-nag` | Ressourcen, Policies, Security-Regeln |
| Frontend | Vitest + Testing Library | Komponenten, Hooks, Editor-State |
| E2E | Playwright mit Desktop-Chrome, iPhone, Pixel | Kernabläufe und `toHaveScreenshot` je Viewport |

E2E-Tests laufen lokal und im PR gegen den Vite-Dev-Server mit Mock-API und nach jedem Deploy als Smoke-Suite gegen `prod`.

Umsetzung (Stand T-34):

- **Projekte:** `desktop-chrome`, `iphone` (iPhone-Viewport mit Chromium) und `pixel`. Das Projekt `setup` (`e2e/tests/auth.setup.ts`) meldet Test- und Admin-User einmal über die Anmeldeseite an und speichert den Login-Status als `storageState` in `e2e/.auth/`. Tests starten daraus mit `signInAs()`; weil jeder Test sein Konto selbst wählt und manche mitten im Test wechseln, wird der gespeicherte localStorage pro Seite gesetzt statt pro Projekt.
- **Abläufe:** Registrierung (`auth.spec.ts`), Beet anlegen (`beds.spec.ts`), Pflanzen setzen (`placement.spec.ts`, `mobile.spec.ts`), Warnung sehen (`warnings.spec.ts`), Zeitachse (`timeline.spec.ts`), eigene Sorte (`own-plants.spec.ts`), Admin-Freigabe (`admin.spec.ts`).
- **Visual Regression:** `toHaveScreenshot` für Editor, Beetübersicht und Katalog je in Light- und Dark-Mode und je Projekt, dazu weitere Zustände (Warnung beim Ziehen, Zeitachse, Bottom-Sheets).
- **Testdaten:** Jeder Test läuft in einem frischen Browser-Kontext, und der Mock hält seine Daten nur in dessen localStorage; `isolation.spec.ts` prüft das. Der angemeldete Smoke-Test in `prod` löscht sein Beet am Ende wieder, auch wenn ein Schritt scheitert, und räumt vorher Reste abgebrochener Läufe weg.
- **CI:** Der Job `e2e` in `ci.yml` läuft je Projekt parallel (Matrix, je höchstens 10 Minuten) im offiziellen Image `mcr.microsoft.com/playwright`; bei Fehlern lädt er `test-results/` als Artefakt hoch. Deployt wird nur, wenn auch er grün ist.
- **Screenshots reproduzierbar:** Schon kleine Unterschiede bei Schriften und Rendering zwischen Rechnern ergeben rund 1 % abweichende Pixel. Deshalb entstehen die Baselines mit `pnpm --filter e2e test:docker` im selben Image wie in der CI.
- **Smoke-Testuser:** `SharedStatefulStack` legt den User `smoke-test@hochbeet.andi-john-dev.de` an, sobald der Deploy das GitHub-Secret `SMOKE_USER_PASSWORD` als NoEcho-Parameter übergibt (ohne Secret entsteht nichts, und der angemeldete Smoke-Test wird übersprungen). Das Passwort setzt eine kleine eigene Funktion per `AdminSetUserPassword`; die generische `AwsCustomResource` von CDK scheidet aus, weil ihr Handler das ganze Event samt Passwort loggt.

## Pipeline (GitHub Actions)

1. Bei jedem Pull Request: Lint, Typecheck, Unit- und Integrationstests, `cdk synth` mit `cdk-nag`, Playwright gegen den Dev-Server mit Mock-API.
2. Bei Merge auf `main`: Build, `cdk deploy --all` per OIDC-Rolle (keine Access Keys im Repo), danach Playwright-Smoke-Tests gegen `prod`.

Umsetzung: `deploy.yml` startet per `workflow_run`, sobald die CI auf `main` grün ist, und deployt genau den getesteten Commit. Der Job läuft in der GitHub-Umgebung `prod`; nur diese darf die Rolle `hochbeet-github-deploy` übernehmen, und die Rolle darf ausschließlich die CDK-Bootstrap-Rollen übernehmen. Die einmalige Einrichtung (Bootstrap, Rolle aus `infra/bootstrap/github-deploy-role.yaml`, GitHub-Umgebung und Variable `AWS_DEPLOY_ROLE_ARN`) steht in [`docs/deployment.md`](../deployment.md). Die Smoke-Tests (`e2e/smoke/`) prüfen ohne Anmeldung Startseite, Deep-Links, `config.json`, das Caching der Assets, die 401 der APIs und den öffentlichen Katalog samt CloudFront-Cache. Mit dem Smoke-Testuser legt `garden.smoke.ts` ein Beet an, setzt Tomate und Kartoffel, prüft Warnung, Speicherung und Zeitachse und löscht das Beet wieder.

Deployt wird ausschließlich über diese Pipeline, nicht aus Entwickler- oder Claude-Code-Sessions.

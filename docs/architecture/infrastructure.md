# Infrastruktur (IaC)

Teil der [Architektur](../architecture.md). CDK-Stacks, CloudFront, SSM-Parameter, Cognito und die bestätigten cdk-nag-Funde.

Eine CDK-App in TypeScript deployt acht Stacks nach `eu-central-1` und den Zertifikat-Stack nach `us-east-1`. Werte zwischen Stacks fließen über SSM-Parameter statt CloudFormation-Exports, damit spätere Änderungen nicht an Export-Sperren scheitern. Einzige Ausnahme ist die Zertifikats-ARN: Sie kommt per `crossRegionReferences` von CDK, das den Wert selbst über SSM-Parameter in die andere Region überträgt.

| Stack | Inhalt | Liest aus SSM |
| --- | --- | --- |
| `Prod-SharedStateful` | Cognito User Pool, SPA-Client (ohne Secret, SRP), Gruppen `admins` und `ai-testers`, monatliches AWS-Budget mit Alarm | – |
| `Prod-CatalogStateful` | DynamoDB-Tabelle mit GSI, Seed per Custom Resource | – |
| `Prod-CatalogStateless` | Lambdalith, HTTP API, JWT-Authorizer | User Pool, Tabelle |
| `Prod-GardenStateful` | DynamoDB-Tabelle | – |
| `Prod-GardenStateless` | Lambdalith, HTTP API, JWT-Authorizer | User Pool, Tabelle |
| `Prod-AssistantStateful` | DynamoDB-Tabelle für das Tageskontingent des Assistenten (TTL), AgentCore Memory des Assistenten (T-44) | – |
| `Prod-Assistant` | AgentCore Runtime mit dem Python-Agenten, JWT-Authorizer und Usage-Logs; AgentCore Gateway mit Tool-Lambda und Request-Interceptor | User Pool, Kontingent-Tabelle; Garden- und Catalog-API über die Domain |
| `Prod-Certificate` | ACM-Zertifikat für die Domain, per DNS in Route 53 validiert; liegt in `us-east-1`, weil CloudFront es dort erwartet | – |
| `Prod-Frontend` | Privater S3-Bucket mit OAC, CloudFront mit eigener Domain (TLS ≥ 1.2), A/AAAA-Alias in Route 53, `config.json`, Deployment des Builds; `/api/assistant/*` zur AgentCore Runtime | User Pool, API-URLs, Runtime-ARN; Zertifikat per Cross-Region-Referenz |

CloudFront routet `/api/catalog/*` und `/api/garden/*` auf die jeweilige HTTP API und alles andere auf den Bucket. Damit gibt es nur eine Origin und keine CORS-Konfiguration. Die Origin-Request-Policy reicht den `Authorization`-Header durch, für `/api/*` ist Caching aus. Einzige Ausnahme ist der öffentliche Katalog unter `/api/catalog/public/*`: Er wird ohne Viewer-Header weitergereicht und 5 Minuten gecacht.

## Frontend-Stack

- **SPA-Fallback:** Eine CloudFront Function (`infra/lib/frontend/spa-rewrite.js`, Viewer Request) schreibt Pfade ohne Dateiendung, etwa `/beete/123`, auf `/index.html` um. Bewusst keine 403/404-Fehlerseiten: Die würden auch Fehlerantworten der APIs durch `index.html` ersetzen.
- **Caching:**

  | Pfad | CloudFront | `Cache-Control` im Bucket |
  | --- | --- | --- |
  | `/assets/*` (Dateinamen mit Hash) | `CachingOptimized` | `public, max-age=31536000, immutable` |
  | `/config.json` | `CachingDisabled` | `no-cache` |
  | `/api/catalog/public/*` | eigene Policy, TTL höchstens 300 s, nichts im Cache-Key | `public, max-age=300` (von der Lambda) |
  | alles andere, v. a. `index.html` | eigene Policy, TTL 0 | `no-cache` |

- **Deployment:** Zwei `BucketDeployment`s mit unterschiedlichem `Cache-Control`, beide ohne `prune`. So bleiben Assets des vorherigen Builds erreichbar, solange Browser noch das alte `index.html` haben. Nach dem Deploy werden `/index.html` und `/config.json` invalidiert.
- **API-Behaviors:** `FrontendStack.addApiBehavior('/api/catalog/*' | '/api/garden/*', origin)` hängt die HTTP APIs an (alle Methoden, alle Viewer-Header außer `Host`, kein Caching). `addPublicApiBehavior('/api/catalog/public/*', origin, maxAge)` hängt den öffentlichen Katalog davor an (nur `GET`/`HEAD`, gecacht); die Reihenfolge zählt, weil CloudFront das erste passende Behavior nimmt.
- Der Bucket ist zustandslos (`DESTROY` mit `autoDeleteObjects`), weil sein Inhalt bei jedem Deploy neu entsteht. `cdk synth` braucht den Build von `apps/web`; Turborepo baut ihn vorher, weil `infra` von `web` abhängt.

Regeln für stateful Stacks: `RemovalPolicy.RETAIN`, Point-in-Time-Recovery, Termination Protection, DynamoDB im On-Demand-Modus. Eine Stage-Konfiguration in `infra/lib/config/stages.ts` enthält nur `prod`; `dev` wird dort später als zweiter Eintrag ergänzt.

Cognito verschickt Mails zunächst über den eingebauten Versand (etwa 50 Mails pro Tag). SES kann später folgen, ebenso der Google-Login als Identity Provider.

## SSM-Parameter

Die Namen stehen zentral in `infra/lib/config/ssm.ts`; `<stage>` ist der Stage-Name aus `stages.ts`, also `prod`.

| Parameter | Geschrieben von | Inhalt |
| --- | --- | --- |
| `/hochbeet/<stage>/shared/user-pool-id` | `Prod-SharedStateful` | ID des User Pools |
| `/hochbeet/<stage>/shared/user-pool-client-id` | `Prod-SharedStateful` | ID des SPA-Clients |
| `/hochbeet/<stage>/catalog/table-name` | `Prod-CatalogStateful` | Name der Catalog-Tabelle |
| `/hochbeet/<stage>/catalog/api-domain` | `Prod-CatalogStateless` | Domain der Catalog-HTTP-API, Origin für `/api/catalog/*` in CloudFront |
| `/hochbeet/<stage>/garden/table-name` | `Prod-GardenStateful` | Name der Garden-Tabelle |
| `/hochbeet/<stage>/garden/api-domain` | `Prod-GardenStateless` | Domain der Garden-HTTP-API, Origin für `/api/garden/*` in CloudFront |
| `/hochbeet/<stage>/assistant/quota-table-name` | `Prod-AssistantStateful` | Tabelle der Tageskontingente, gelesen von `Prod-Assistant` |
| `/hochbeet/<stage>/assistant/memory-id` | `Prod-AssistantStateful` | ID der AgentCore Memory, gelesen von `Prod-Assistant` |
| `/hochbeet/<stage>/assistant/gateway-url` | `Prod-Assistant` | MCP-Endpunkt der Tools, gelesen vom Modellvergleich (`assistant-eval.yml`) |
| `/hochbeet/<stage>/assistant/runtime-arn` | `Prod-Assistant` | ARN der AgentCore Runtime, gelesen von `Prod-Frontend` für `/api/assistant/*` |

## Cognito-Konfiguration

- Feature-Plan **Lite**: E-Mail-Login, Selbstregistrierung und SRP sind enthalten, Kosten im Leerlauf nahe null.
- Passwortrichtlinie: mindestens 8 Zeichen mit Groß- und Kleinbuchstaben, Ziffer und Sonderzeichen.
- Kontowiederherstellung nur per E-Mail; der SPA-Client verhindert Hinweise darauf, ob ein Konto existiert.
- Löschschutz am User Pool, `RETAIN` und Termination Protection am Stack.

## cdk-nag

cdk-nag (AwsSolutions) läuft als Policy-Validation-Plugin über die ganze App; jeder nicht bestätigte Fund lässt `cdk synth` und damit die CI scheitern. Bewusst bestätigte Funde (`Validations.of(...).acknowledge`):

| Regel | Ressource | Begründung |
| --- | --- | --- |
| `AwsSolutions-COG2` (MFA nicht Pflicht) | User Pool | Hobby-App; vereinbart ist Login per E-Mail und Passwort. MFA kann später optional ergänzt werden. |
| `AwsSolutions-COG8` (kein Plus-Feature-Plan) | User Pool | Threat Protection gibt es nur im Plus-Plan, der pro aktivem User kostet; die App soll im Leerlauf nahezu nichts kosten. |
| `AwsSolutions-S1` (keine Server-Access-Logs) | Web-Bucket | Nur CloudFront liest den Bucket; Logs kosten ohne Nutzen. |
| `AwsSolutions-CFR1` (keine Geo-Sperre) | Distribution | Die App soll überall nutzbar sein. |
| `AwsSolutions-CFR2` (kein WAF) | Distribution | WAF kostet monatlich pro Web-ACL; die App soll im Leerlauf nahezu nichts kosten. |
| `AwsSolutions-CFR3` (keine Access-Logs) | Distribution | Für eine Hobby-App nicht nötig, kostet Speicher. |
| `AwsSolutions-IAM4` (AWS-managed Policy) | Catalog- und Garden-Lambdalith (`ServiceApiStack`) | `AWSLambdaBasicExecutionRole` erlaubt nur das Schreiben der eigenen Logs; Tabellenzugriff regelt eine eigene Policy (nur Item-Operationen auf der Tabelle und `Query` auf `GSI1`, kein Scan, keine Index-Wildcard). |
| `AwsSolutions-APIG4` (Route ohne Autorisierung) | Route `GET /api/catalog/public/plants` (`ServiceApiStack`, `publicGetPaths`) | Bewusst öffentlich für Gäste: nur lesend, ohne User-Daten, von CloudFront gecacht und mit eigenem, niedrigem Throttling. |
| `AwsSolutions-IAM4` (AWS-managed Policy) | Seed-Funktion im Catalog-Stack | `AWSLambdaBasicExecutionRole` erlaubt nur das Schreiben der eigenen Logs; auf die Tabelle darf die Funktion nur `PutItem`. |
| `AwsSolutions-IAM4`, `-IAM5` | Provider-Framework der Seed-Custom-Resource | Von aws-cdk-lib erzeugt; Rolle und Aufrufrecht (`<Seed-Funktion>:*`) lassen sich nicht anpassen. |
| `AwsSolutions-IAM4` (AWS-managed Policy) | Passwort-Funktion des Smoke-Testusers (`SharedStatefulStack`) | `AWSLambdaBasicExecutionRole` erlaubt nur das Schreiben der eigenen Logs; sonst darf die Funktion nur `AdminSetUserPassword` auf diesem User Pool. |
| `AwsSolutions-IAM4` (AWS-managed Policy) | Tool- und Interceptor-Lambda des Gateways (`AssistantStack`) | `AWSLambdaBasicExecutionRole` erlaubt nur das Schreiben der eigenen Logs; weitere AWS-Rechte brauchen die Funktionen nicht. |
| `AwsSolutions-IAM5` | Rolle des AgentCore Gateways (`AssistantStack`) | Vom Gateway-Construct erzeugt: das Aufrufrecht auf Tool- und Interceptor-Lambda umfasst `<Funktion>:*` (Versionen und Aliase). Einzeln bestätigt. |
| `AwsSolutions-IAM5` | Rolle der AgentCore Runtime (`AssistantStack`) | Das EU-Inference-Profil leitet auf dasselbe Modell in mehreren EU-Regionen, deshalb braucht die Modell-ARN eine Regions-Wildcard. Die übrigen Wildcards (eigene Logs, X-Ray-Segmente, Metriken mit Namespace-Bedingung, Workload Identity, Lesezugriff auf den CDK-Asset-Bucket für den Code-Zip) erzeugt das L2-Construct selbst. Jeder Fund ist einzeln bestätigt. |
| `AwsSolutions-L1`, `-IAM4`, `-IAM5` | Lambda von `BucketDeployment` | Von aws-cdk-lib erzeugt und verwaltet; Rolle und Runtime lassen sich nicht sinnvoll anpassen. Die IAM5-Funde sind einzeln bestätigt. |

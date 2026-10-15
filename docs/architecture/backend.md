# Backend

Teil der [Architektur](../architecture.md). Gemeinsamer Aufbau der Services (HTTP API, Lambdalith, Hono) und der Service-Code in `@hochbeet/service-kit`.

Jeder Service besteht aus einer HTTP API (API Gateway v2) mit Cognito-JWT-Authorizer und einer Lambdalith auf Node.js 22. Das Routing innerhalb der Lambda übernimmt Hono mit Zod-Validierung, gebaut wird mit esbuild über `NodejsFunction`. Die `userId` stammt immer aus dem `sub`-Claim des Tokens, nie aus dem Request-Body.

Die Services rufen sich nicht gegenseitig auf. Der Garden-Service prüft nur die Struktur (Position im Beet, Raster-Vielfache, gültige Daten), die fachlichen Warnungen berechnet das Frontend.

## Gemeinsamer Service-Code

`packages/service-kit` (`@hochbeet/service-kit`) enthält, was alle Lambdaliths teilen:

- `createServiceApp(basePath, logger)` erzeugt eine Hono-App mit User-Kontext aus den JWT-Claims (401 ohne), einer JSON-Logzeile pro Request und deutschen Fehlerantworten. `ValidationError` wird zu 400, `NotFoundError` zu 404, `ConflictError` zu 409, alles andere zu 500.
- `parseBody(c, schema)` prüft den Request-Body gegen ein Contract-Schema. Zod läuft mit deutscher Locale (`z.locales.de()`); auch Meldungen ohne eigenen Text kommen also auf Deutsch.
- Dazu kommen `userFromEvent`, `isAdmin` und `createLogger`.
- `@hochbeet/service-kit/testing` bietet DynamoDB Local über Testcontainers (`startDynamoDbTable`) und `authorized()` für Claims in Tests.

In der Infrastruktur legt `ServiceApiStack` (`infra/lib/shared/`) für jeden Service dieselben Bausteine an:

- Lambdalith, HTTP API mit JWT-Authorizer, Access-Logs und Throttling;
- IAM nur für Item-Operationen auf der Tabelle, optional `Query` auf benannte Indizes;
- den SSM-Parameter mit der API-Domain.

`CatalogStatelessStack` und `GardenStatelessStack` sind nur noch Konfiguration. Das Catalog-Template hat sich durch die Umstellung nicht geändert.

# Backend

Teil der [Architektur](../architecture.md). Gemeinsamer Aufbau der Services (HTTP API, Lambdalith, Hono) und der Service-Code in `@hochbeet/service-kit`.

Jeder Service besteht aus einer HTTP API (API Gateway v2) mit Cognito-JWT-Authorizer und einer Lambdalith auf Node.js 22. Das Routing innerhalb der Lambda übernimmt Hono mit Zod-Validierung, gebaut wird mit esbuild über `NodejsFunction`. Die `userId` stammt immer aus dem `sub`-Claim des Tokens, nie aus dem Request-Body.

Die Services rufen sich nicht gegenseitig auf. Der Garden-Service prüft nur die Struktur (Position im Beet, Raster-Vielfache, gültige Daten), die fachlichen Warnungen berechnet das Frontend.

## Gemeinsamer Service-Code

`packages/service-kit` (`@hochbeet/service-kit`) enthält, was alle Lambdaliths teilen:

- `createServiceApp(basePath, logger)` erzeugt eine Hono-App mit User-Kontext aus den JWT-Claims (401 ohne), einer JSON-Logzeile pro Request und Fehlerantworten in der Sprache des Aufrufers (siehe unten). `ValidationError` wird zu 400, `ForbiddenError` zu 403, `NotFoundError` zu 404, `ConflictError` zu 409, alles andere zu 500. Alle sind `ServiceError` mit Status und Schlüssel.
- `parseBody(c, schema)` prüft den Request-Body gegen ein Contract-Schema, mit den Zod-Standardmeldungen in der Sprache des Aufrufers.
- `requestLocale(c)` liefert die Sprache aus `Accept-Language`.
- Dazu kommen `userFromEvent`, `isAdmin` und `createLogger`.
- `@hochbeet/service-kit/testing` bietet DynamoDB Local über Testcontainers (`startDynamoDbTable`) und `authorized()` für Claims in Tests.

In der Infrastruktur legt `ServiceApiStack` (`infra/lib/shared/`) für jeden Service dieselben Bausteine an:

- Lambdalith, HTTP API mit JWT-Authorizer, Access-Logs und Throttling;
- IAM nur für Item-Operationen auf der Tabelle, optional `Query` auf benannte Indizes;
- den SSM-Parameter mit der API-Domain.

`CatalogStatelessStack` und `GardenStatelessStack` sind nur noch Konfiguration. Das Catalog-Template hat sich durch die Umstellung nicht geändert.

## Sprache der Fehlermeldungen

Seit T-70 antworten die Services auf Deutsch oder Englisch. Die Antwortform bleibt `{ message, issues? }` (`ErrorResponseSchema`).

- **Sprache:** aus `Accept-Language` über `localeFromHeader()` aus `packages/contracts`. Es zählt der erste Eintrag: `en`, `en-GB` usw. ergeben Englisch, alles andere und ein fehlender Header Deutsch. Die App sendet immer ihre Sprache. Die Assistent-Tools senden keinen Header und bekommen deshalb Deutsch.
- **Texte:** Alle Meldungen liegen in `packages/contracts/src/messages/{de,en}.ts` (Typ `Messages`, also in beiden Sprachen Pflicht). `validation` enthält die eigenen Meldungen der Schemas und die Feldprüfungen der Services (Nachbarn), `errors` den `message` der Fehlerantworten (`ErrorKey`, z. B. `bedNotFound`, `checkInput`, `signIn`).
- **Schlüssel statt Texte in den Schemas:** Eigene Meldungen stehen als `messageKey('maxChars', { max: 60 })` im Schema, also als stabiler Schlüssel mit Parametern (`maxChars|{"max":60}`). Erst `localizeIssues(error, locale)` bzw. `localizeMessage(message, locale)` machen daraus Text. Andere Meldungen, etwa die von Zod, bleiben unverändert. Frontend, lokale API und Services nutzen dieselben Funktionen.
- **Zod-Standardmeldungen** (z. B. „Ungültige Option“) pro Aufruf über `safeParseIn(schema, value, locale)`, also mit der Fehler-Map aus `z.locales.de()` bzw. `z.locales.en()`. Eigene Meldungen haben Vorrang, die Map füllt nur den Rest.
- **Services:** Fehler werfen nur Schlüssel (`new NotFoundError('bedNotFound')`). `onError` schreibt den Text in der Sprache des Requests, auch für Schlüssel in den `issues`.
- **Assistent:** Die Meldungen des Agenten und seiner Tools bleiben bis T-72 deutsch. Die Schlüssel der Anfrage (`questionRequired`, `questionTooLong`) haben schon beide Texte, der Mock nutzt sie.

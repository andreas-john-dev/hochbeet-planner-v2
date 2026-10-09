# Deployment

Jeder Commit auf `main`, dessen CI grün ist, wird automatisch nach `prod` deployt. Der Workflow `.github/workflows/deploy.yml`:

1. startet nach erfolgreicher CI auf `main` (oder manuell über „Run workflow“),
2. meldet sich per OIDC bei AWS an – es gibt keine Access Keys, weder im Repo noch in GitHub-Secrets,
3. baut die App und führt `cdk deploy --all` aus,
4. testet die App unter https://hochbeet.andi-john-dev.de mit den Playwright-Smoke-Tests (`e2e/smoke/`). Schlägt ein Test fehl, ist der Workflow rot.

Solange die einmalige Einrichtung unten fehlt, wird der Deploy mit einer Warnung übersprungen.

## Einmalige Einrichtung

Diese Schritte führst du selbst aus, nicht aus einer Claude-Code-Session. Du brauchst dafür:

- ein AWS-Konto und lokal die AWS CLI mit Admin-Zugang zu diesem Konto (z. B. per `aws configure sso` oder ein Profil),
- Node 22 und pnpm, `pnpm install` im Repo ausgeführt.

In den Beispielen ist `123456789012` deine AWS-Account-ID und `admin` dein AWS-CLI-Profil.

### 1. CDK bootstrappen

Legt die Rollen und den Asset-Bucket an, die CDK zum Deployen nutzt: in `eu-central-1` für die App und in `us-east-1` für das TLS-Zertifikat, weil CloudFront Zertifikate nur aus `us-east-1` annimmt.

```bash
pnpm --filter infra exec cdk bootstrap \
  aws://123456789012/eu-central-1 aws://123456789012/us-east-1 --profile admin
```

### 2. Deploy-Rolle für GitHub anlegen

Das Template `infra/bootstrap/github-deploy-role.yaml` legt den OIDC-Provider für GitHub und die Rolle `hochbeet-github-deploy` an. Die Rolle darf

- nur von Jobs dieses Repos in der GitHub-Umgebung `prod` übernommen werden und
- selbst nur die Bootstrap-Rollen von CDK in `eu-central-1` und `us-east-1` übernehmen (`cdk-hnb659fds-*`), sonst nichts.

```bash
aws cloudformation deploy \
  --template-file infra/bootstrap/github-deploy-role.yaml \
  --stack-name hochbeet-github-deploy-role \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-central-1 \
  --profile admin

aws cloudformation describe-stacks \
  --stack-name hochbeet-github-deploy-role \
  --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" \
  --output text --region eu-central-1 --profile admin
```

Gibt es im Konto schon einen OIDC-Provider für `token.actions.githubusercontent.com`, hänge `--parameter-overrides CreateOidcProvider=false` an.

Nutzt das Repo unveränderliche OIDC-Subjects (`use_immutable_subject: true` in
`gh api repos/andreas-john-dev/hochbeet-planner-v2/actions/oidc/customization/sub`), setze zusätzlich
`GitHubSubjectPrefix` auf den dort angezeigten `sub_claim_prefix`, z. B.
`--parameter-overrides CreateOidcProvider=false 'GitHubSubjectPrefix=repo:andreas-john-dev@15031893/hochbeet-planner-v2@1408917306'`.

Die Domain `hochbeet.andi-john-dev.de` und die Hosted Zone stehen in `infra/lib/config/stages.ts`. Die Hosted Zone muss im selben AWS-Konto liegen; CDK legt dort den Validierungseintrag für das Zertifikat und die Alias-Einträge auf CloudFront an.

### 3. GitHub einrichten

1. **Umgebung:** Settings → Environments → *New environment* → Name `prod`. Unter *Deployment branches and tags* „Selected branches and tags“ wählen und `main` eintragen.
2. **Variable:** Settings → Secrets and variables → Actions → Tab *Variables* → *New repository variable*
   - Name: `AWS_DEPLOY_ROLE_ARN`
   - Wert: die `RoleArn` aus Schritt 2, z. B. `arn:aws:iam::123456789012:role/hochbeet-github-deploy`

   Die ARN ist kein Geheimnis, deshalb eine Variable und kein Secret.
3. **Secret für den Smoke-Testuser** (empfohlen): Settings → Environments → `prod` → *Environment secrets* → *Add secret*
   - Name: `SMOKE_USER_PASSWORD`
   - Wert: ein eigenes Passwort nach der Richtlinie des User Pools (mindestens 8 Zeichen, Groß- und Kleinbuchstabe, Ziffer, Sonderzeichen), z. B. aus einem Passwortmanager.

   Beim nächsten Deploy legt `Prod-SharedStateful` den User `smoke-test@hochbeet.andi-john-dev.de` an und setzt dieses Passwort. Die Smoke-Tests melden sich damit an, legen ein Beet mit Pflanzen an, prüfen die Warnung und löschen das Beet wieder. Ein neuer Wert ändert das Passwort beim nächsten Deploy. Ohne Secret wird der angemeldete Smoke-Test mit einer Warnung übersprungen. Der User ist auch in der Gruppe `ai-testers` und stellt dem Beet-Assistenten eine kurze Frage (eine seiner 20 Fragen am Tag).
4. **Variable für den Budget-Alarm** (empfohlen): wie in Schritt 2 eine Repository-Variable
   - Name: `BUDGET_ALERT_EMAIL`
   - Wert: die Adresse, die bei 80 % und 100 % des Monatsbudgets (10 USD, `monthlyBudgetUsd` in `infra/lib/config/stages.ts`) eine Mail bekommt.

   Der Deploy übergibt sie als CDK-Context; sie steht nie im Repository. AWS schickt beim ersten Mal keine Bestätigungsmail, die Alarme kommen direkt. Ohne Variable entsteht das Budget ohne Alarme, und der Deploy warnt.
5. **Claude-Modell für den Beet-Assistenten freischalten** (einmal pro AWS-Konto): Bedrock legt für Anthropic-Modelle beim ersten Aufruf ein AWS-Marketplace-Abo an. Das darf nur ein User mit Marketplace-Rechten, nicht die Rolle der Runtime. Deshalb einmal als Admin aufrufen, zum Beispiel in der Bedrock-Konsole (Model catalog → Claude Haiku 4.5 → Playground) oder per CLI:

   ```bash
   aws bedrock-runtime converse --region eu-central-1 \
     --model-id eu.anthropic.claude-haiku-4-5-20251001-v1:0 \
     --messages '[{"role":"user","content":[{"text":"Hallo"}]}]'
   ```

   Fragt die Konsole nach Use-Case-Angaben für Anthropic, diese einmal ausfüllen. Das Abo erscheint unter AWS Marketplace → *Manage subscriptions*.

### 4. Erster Deploy

Actions → *Deploy* → *Run workflow* auf `main`. Der erste Lauf dauert wegen CloudFront und der Zertifikatsprüfung etwa 10–20 Minuten. Danach ist die App unter https://hochbeet.andi-john-dev.de erreichbar; die URL steht auch in der Zusammenfassung des Laufs und unter *Deployments* → `prod`.

### Umstellung einer bestehenden Einrichtung auf die eigene Domain

Wer die Einrichtung schon vor der eigenen Domain gemacht hat, braucht einmalig:

1. `us-east-1` bootstrappen: `pnpm --filter infra exec cdk bootstrap aws://123456789012/us-east-1 --profile admin`
2. Die Deploy-Rolle aktualisieren: den `aws cloudformation deploy`-Befehl aus Schritt 2 erneut ausführen, mit denselben `--parameter-overrides` wie beim ersten Mal. Damit darf die Rolle auch die Bootstrap-Rollen in `us-east-1` übernehmen.

## Betrieb

- **Smoke-Tests lokal gegen prod:** `SMOKE_BASE_URL=https://hochbeet.andi-john-dev.de pnpm --filter e2e smoke`
- **Fehlgeschlagener Smoke-Test:** Die Ergebnisse inklusive Traces hängen als Artefakt `smoke-test-results` am Lauf.
- **Kosten:** Im Leerlauf fallen praktisch nur Cent-Beträge an (S3, CloudFront, SSM, Route-53-Abfragen; Cognito Lite ist bis 10.000 aktive Nutzer kostenlos). Das ACM-Zertifikat ist kostenlos.
- **Abbauen:** `Prod-SharedStateful` hat Termination Protection und der User Pool Löschschutz; beides muss vor dem Löschen in der AWS-Konsole bewusst abgeschaltet werden. Der User Pool bleibt wegen `RETAIN` danach trotzdem bestehen.

## Fehlersuche

| Meldung | Ursache |
| --- | --- |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Job läuft nicht in der Umgebung `prod`, Repo-Name im Template weicht ab, OIDC-Provider fehlt oder das Repo nutzt unveränderliche Subjects und `GitHubSubjectPrefix` ist nicht gesetzt (siehe Schritt 2). |
| `ResourceExistenceCheck` beim Anlegen der Deploy-Rolle | OIDC-Provider existiert schon im Konto; `CreateOidcProvider=false` setzen. |
| `… is not authorized to perform: sts:AssumeRole on resource: …cdk-hnb659fds-…` | `cdk bootstrap` fehlt in `eu-central-1` oder `us-east-1`, die Deploy-Rolle ist noch nicht aktualisiert (siehe „Umstellung“) oder der Qualifier weicht ab (dann `CdkQualifier` im Template anpassen). |
| `Prod-Certificate` hängt lange in `CREATE_IN_PROGRESS` | ACM wartet auf die DNS-Validierung; die Hosted Zone muss die öffentlich delegierte Zone von `andi-john-dev.de` sein. |
| `This stack uses assets, so the toolkit stack must be deployed` | Schritt 1 fehlt. |
| `Unable to fetch parameters [/hochbeet/prod/shared/…]` | `Prod-SharedStateful` ist nicht deployt; `cdk deploy --all` deployt ihn eigentlich vor `Prod-Frontend`. |
| `Model access is denied … AWS Marketplace actions (aws-marketplace:ViewSubscriptions, aws-marketplace:Subscribe)` | Das Marketplace-Abo für das Claude-Modell fehlt (Schritt 5). Kommt die Meldung auch beim Aufruf als Admin mit „subscription … cannot be completed at this time“, ist meist die Zahlungsmethode ungültig (Billing → *Payment methods*), das Konto noch in der Verifizierung oder eine SCP der Organization verbietet Marketplace-Aktionen. |
| Smoke-Test „answers the smoke user“ mit 429 | Das Tageskontingent des Smoke-Users ist aufgebraucht (mehr als 20 Deploys bzw. Wiederholungen an einem Tag); am nächsten Tag geht es wieder. |
| `… is in UPDATE_ROLLBACK_FAILED state and can not be updated` | Ein vorheriger Deploy ist gescheitert und auch sein Rollback. Der Stack muss einmal manuell weiterrollen, bevor die Pipeline wieder deployen kann (siehe unten). |
| `Unable to find Route by key … within the provided RouteSettings` | Die Stage wurde vor der Route aktualisiert, die ihre `RouteSettings` nennen. `ServiceApiStack` setzt dafür eine explizite Abhängigkeit der Stage auf die öffentlichen Routen (seit dem Fix nach T-37). |

### Stack in `UPDATE_ROLLBACK_FAILED`

CloudFormation blockiert jedes weitere Update, bis der Rollback abgeschlossen ist. Mit Admin-Rechten im Konto (nicht über die Deploy-Rolle der Pipeline):

1. In der Konsole unter CloudFormation → Stack → **Stack-Aktionen → Rollback für Update fortsetzen** öffnen und die Ressource überspringen, deren Rollback scheiterte (sie steht in den Stack-Events), oder per CLI:

   ```bash
   aws cloudformation continue-update-rollback --region eu-central-1 \
     --stack-name Prod-CatalogStateless --resources-to-skip ApiDefaultStage189A7074
   ```

2. Warten, bis der Stack `UPDATE_ROLLBACK_COMPLETE` meldet.
3. Den letzten Deploy-Lauf in GitHub neu starten (oder den Fix mergen); er bringt die übersprungene Ressource wieder auf den Stand des Codes.

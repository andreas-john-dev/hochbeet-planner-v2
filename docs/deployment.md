# Deployment

Jeder Commit auf `main`, dessen CI grün ist, wird automatisch nach `prod` deployt. Der Workflow `.github/workflows/deploy.yml`:

1. startet nach erfolgreicher CI auf `main` (oder manuell über „Run workflow“),
2. meldet sich per OIDC bei AWS an – es gibt keine Access Keys, weder im Repo noch in GitHub-Secrets,
3. baut die App und führt `cdk deploy --all` aus,
4. testet die App unter der CloudFront-URL mit den Playwright-Smoke-Tests (`e2e/smoke/`). Schlägt ein Test fehl, ist der Workflow rot.

Solange die einmalige Einrichtung unten fehlt, wird der Deploy mit einer Warnung übersprungen.

## Einmalige Einrichtung

Diese Schritte führst du selbst aus, nicht aus einer Claude-Code-Session. Du brauchst dafür:

- ein AWS-Konto und lokal die AWS CLI mit Admin-Zugang zu diesem Konto (z. B. per `aws configure sso` oder ein Profil),
- Node 22 und pnpm, `pnpm install` im Repo ausgeführt.

In den Beispielen ist `123456789012` deine AWS-Account-ID und `admin` dein AWS-CLI-Profil.

### 1. CDK bootstrappen

Legt in `eu-central-1` die Rollen und den Asset-Bucket an, die CDK zum Deployen nutzt.

```bash
pnpm --filter infra exec cdk bootstrap aws://123456789012/eu-central-1 --profile admin
```

### 2. Deploy-Rolle für GitHub anlegen

Das Template `infra/bootstrap/github-deploy-role.yaml` legt den OIDC-Provider für GitHub und die Rolle `hochbeet-github-deploy` an. Die Rolle darf

- nur von Jobs dieses Repos in der GitHub-Umgebung `prod` übernommen werden und
- selbst nur die Bootstrap-Rollen von CDK übernehmen (`cdk-hnb659fds-*`), sonst nichts.

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

### 3. GitHub einrichten

1. **Umgebung:** Settings → Environments → *New environment* → Name `prod`. Unter *Deployment branches and tags* „Selected branches and tags“ wählen und `main` eintragen.
2. **Variable:** Settings → Secrets and variables → Actions → Tab *Variables* → *New repository variable*
   - Name: `AWS_DEPLOY_ROLE_ARN`
   - Wert: die `RoleArn` aus Schritt 2, z. B. `arn:aws:iam::123456789012:role/hochbeet-github-deploy`

   Die ARN ist kein Geheimnis, deshalb eine Variable und kein Secret.

### 4. Erster Deploy

Actions → *Deploy* → *Run workflow* auf `main`. Der erste Lauf dauert wegen CloudFront etwa 10–15 Minuten. Die URL der App steht danach in der Zusammenfassung des Laufs und unter *Deployments* → `prod`.

## Betrieb

- **Smoke-Tests lokal gegen prod:** `SMOKE_BASE_URL=https://<id>.cloudfront.net pnpm --filter e2e smoke`
- **Fehlgeschlagener Smoke-Test:** Die Ergebnisse inklusive Traces hängen als Artefakt `smoke-test-results` am Lauf.
- **Kosten:** Im Leerlauf fallen praktisch nur Cent-Beträge an (S3, CloudFront, SSM; Cognito Lite ist bis 10.000 aktive Nutzer kostenlos).
- **Abbauen:** `Prod-SharedStateful` hat Termination Protection und der User Pool Löschschutz; beides muss vor dem Löschen in der AWS-Konsole bewusst abgeschaltet werden. Der User Pool bleibt wegen `RETAIN` danach trotzdem bestehen.

## Fehlersuche

| Meldung | Ursache |
| --- | --- |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Job läuft nicht in der Umgebung `prod`, Repo-Name im Template weicht ab oder OIDC-Provider fehlt. |
| `… is not authorized to perform: sts:AssumeRole on resource: …cdk-hnb659fds-…` | `cdk bootstrap` fehlt in `eu-central-1` oder wurde mit anderem Qualifier ausgeführt (dann `CdkQualifier` im Template anpassen). |
| `This stack uses assets, so the toolkit stack must be deployed` | Schritt 1 fehlt. |
| `Unable to fetch parameters [/hochbeet/prod/shared/…]` | `Prod-SharedStateful` ist nicht deployt; `cdk deploy --all` deployt ihn eigentlich vor `Prod-Frontend`. |

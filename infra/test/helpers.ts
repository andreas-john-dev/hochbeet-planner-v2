import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import type { StageConfig } from '../lib/config/stages';

export const stage: StageConfig = { name: 'prod', stackPrefix: 'Prod', region: 'eu-central-1' };
export const env = { account: '123456789012', region: stage.region };

interface ValidationReport {
  pluginReports: { pluginName: string; violations: { ruleName: string }[] }[];
}

/** App with cdk-nag (AwsSolutions) attached, writing into a temporary cloud assembly. */
export function createApp() {
  const outdir = mkdtempSync(join(tmpdir(), 'cdk-'));
  const app = new App({ outdir });
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app));
  return { app, outdir };
}

/** Synthesises the app and returns the cdk-nag rule names that were not acknowledged. */
export function synthAndCollectNagViolations(app: App, outdir: string): string[] {
  app.synth();
  const report = JSON.parse(
    readFileSync(join(outdir, 'validation-report.json'), 'utf8'),
  ) as ValidationReport;
  return report.pluginReports
    .filter((r) => r.pluginName === 'AwsSolutions')
    .flatMap((r) => r.violations.map((v) => v.ruleName));
}

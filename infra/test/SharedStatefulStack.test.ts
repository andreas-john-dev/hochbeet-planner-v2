import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App, Validations } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { beforeAll, describe, expect, it } from 'vitest';
import type { StageConfig } from '../lib/config/stages';
import { SharedStatefulStack } from '../lib/shared/SharedStatefulStack';

interface ValidationReport {
  pluginReports: { pluginName: string; violations: { ruleName: string }[] }[];
}

const stage: StageConfig = { name: 'prod', stackPrefix: 'Prod', region: 'eu-central-1' };

describe('SharedStatefulStack', () => {
  let stack: SharedStatefulStack;
  let template: Template;
  let validationReport: ValidationReport;

  beforeAll(() => {
    const outdir = mkdtempSync(join(tmpdir(), 'cdk-'));
    const app = new App({ outdir });
    stack = new SharedStatefulStack(app, 'Prod-SharedStateful', {
      env: { account: '123456789012', region: stage.region },
      stage,
    });
    Validations.of(app).addPlugins(new AwsSolutionsChecks(app));
    app.synth();
    template = Template.fromStack(stack);
    validationReport = JSON.parse(
      readFileSync(join(outdir, 'validation-report.json'), 'utf8'),
    ) as ValidationReport;
  });

  it('enables termination protection', () => {
    expect(stack.terminationProtection).toBe(true);
  });

  it('creates a retained user pool with email login and self sign-up', () => {
    template.resourceCountIs('AWS::Cognito::UserPool', 1);
    template.hasResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: Match.objectLike({
        UsernameAttributes: ['email'],
        AutoVerifiedAttributes: ['email'],
        AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
        DeletionProtection: 'ACTIVE',
        UserPoolTier: 'LITE',
      }),
    });
  });

  it('creates a SPA client without secret that uses SRP', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
      ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_SRP_AUTH']),
      PreventUserExistenceErrors: 'ENABLED',
    });
    const flows = Object.values(template.findResources('AWS::Cognito::UserPoolClient'))
      .map((r) => (r as { Properties: { ExplicitAuthFlows: string[] } }).Properties)
      .flatMap((p) => p.ExplicitAuthFlows);
    expect(flows).not.toContain('ALLOW_USER_PASSWORD_AUTH');
  });

  it('creates the admins group', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'admins' });
  });

  it('publishes user pool and client id to SSM', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/hochbeet/prod/shared/user-pool-id',
      Value: { Ref: Match.stringLikeRegexp('^UserPool') },
    });
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/hochbeet/prod/shared/user-pool-client-id',
      Value: { Ref: Match.stringLikeRegexp('^UserPoolSpaClient') },
    });
  });

  it('has no unacknowledged cdk-nag AwsSolutions findings', () => {
    const violations = validationReport.pluginReports
      .filter((r) => r.pluginName === 'AwsSolutions')
      .flatMap((r) => r.violations.map((v) => v.ruleName));
    expect(violations).toEqual([]);
  });
});

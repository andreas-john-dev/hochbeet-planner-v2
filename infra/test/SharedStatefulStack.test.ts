import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { SharedStatefulStack } from '../lib/shared/SharedStatefulStack';
import { createApp, env, stage, synthAndCollectNagViolations } from './helpers';

describe('SharedStatefulStack', () => {
  let stack: SharedStatefulStack;
  let template: Template;
  let nagViolations: string[];

  beforeAll(() => {
    const { app, outdir } = createApp();
    stack = new SharedStatefulStack(app, 'Prod-SharedStateful', { env, stage });
    nagViolations = synthAndCollectNagViolations(app, outdir);
    template = Template.fromStack(stack);
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
    expect(nagViolations).toEqual([]);
  });
});

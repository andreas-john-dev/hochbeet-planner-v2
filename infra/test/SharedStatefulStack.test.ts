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
    stack = new SharedStatefulStack(app, 'Prod-SharedStateful', {
      env,
      stage,
      budgetAlertEmail: 'budget@example.com',
    });
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

  it('creates the admins and ai-testers groups', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'admins' });
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'ai-testers' });
  });

  it('alerts by mail at 80 and 100 % of the monthly budget', () => {
    const subscribers = [{ SubscriptionType: 'EMAIL', Address: 'budget@example.com' }];
    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: {
        BudgetName: 'hochbeet-prod-monthly',
        BudgetType: 'COST',
        TimeUnit: 'MONTHLY',
        BudgetLimit: { Amount: stage.monthlyBudgetUsd, Unit: 'USD' },
      },
      NotificationsWithSubscribers: [80, 100].map((threshold) => ({
        Notification: {
          NotificationType: 'ACTUAL',
          ComparisonOperator: 'GREATER_THAN',
          Threshold: threshold,
          ThresholdType: 'PERCENTAGE',
        },
        Subscribers: subscribers,
      })),
    });
  });

  it('keeps the budget without alerts when no address is configured', () => {
    const { app } = createApp();
    const withoutMail = new SharedStatefulStack(app, 'NoMail', { env, stage });
    Template.fromStack(withoutMail).hasResourceProperties('AWS::Budgets::Budget', {
      NotificationsWithSubscribers: Match.absent(),
    });
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

  it('creates the smoke test user only when the deploy passes a password', () => {
    template.hasParameter('SmokeUserPassword', { Type: 'String', NoEcho: true, Default: '' });
    template.hasCondition('HasSmokeUser', {
      'Fn::Not': [{ 'Fn::Equals': [{ Ref: 'SmokeUserPassword' }, ''] }],
    });
    template.hasResource('AWS::Cognito::UserPoolUser', {
      Condition: 'HasSmokeUser',
      Properties: {
        Username: stage.smokeUserEmail,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: stage.smokeUserEmail },
          { Name: 'email_verified', Value: 'true' },
        ],
        UserPoolId: Match.anyValue(),
      },
    });
    // The smoke test asks the assistant once, so the user is an AI tester.
    template.hasResource('AWS::Cognito::UserPoolUserToGroupAttachment', {
      Condition: 'HasSmokeUser',
      Properties: Match.objectLike({ Username: stage.smokeUserEmail, GroupName: 'ai-testers' }),
    });
    template.hasOutput('SmokeUserEmail', {
      Condition: 'HasSmokeUser',
      Value: stage.smokeUserEmail,
    });
  });

  it('sets a permanent password with an own handler that never logs the event', () => {
    template.hasResource('Custom::SmokeUserPassword', {
      Condition: 'HasSmokeUser',
      Properties: Match.objectLike({
        Username: stage.smokeUserEmail,
        Password: { Ref: 'SmokeUserPassword' },
      }),
    });
    const [fn] = Object.values(
      template.findResources('AWS::Lambda::Function', { Condition: 'HasSmokeUser' }),
    );
    const code = (fn as { Properties: { Code: { ZipFile: string } } }).Properties.Code.ZipFile;
    expect(code).toContain('AdminSetUserPasswordCommand');
    expect(code).toContain('Permanent: true');
    expect(code).not.toMatch(/console\.(log|error)\([^)]*event/);
    // The handler may only set passwords in this user pool.
    template.hasResource('AWS::IAM::Policy', {
      Condition: 'HasSmokeUser',
      Properties: Match.objectLike({
        PolicyDocument: Match.objectLike({
          Statement: [
            Match.objectLike({
              Action: 'cognito-idp:AdminSetUserPassword',
              Resource: { 'Fn::GetAtt': [Match.stringLikeRegexp('^UserPool'), 'Arn'] },
            }),
          ],
        }),
      }),
    });
  });
});

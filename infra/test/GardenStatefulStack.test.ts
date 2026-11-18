import { VIEW_MIGRATION_VERSION } from '@hochbeet/garden-service';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { GardenStatefulStack } from '../lib/garden/GardenStatefulStack';
import { createApp, env, stage, synthAndCollectNagViolations } from './helpers';

describe('GardenStatefulStack', () => {
  let stack: GardenStatefulStack;
  let template: Template;
  let nagViolations: string[];

  beforeAll(() => {
    const { app, outdir } = createApp();
    stack = new GardenStatefulStack(app, 'Prod-GardenStateful', { env, stage });
    nagViolations = synthAndCollectNagViolations(app, outdir);
    template = Template.fromStack(stack);
  });

  it('enables termination protection', () => {
    expect(stack.terminationProtection).toBe(true);
  });

  it('creates a retained on-demand table with PITR, deletion protection and no indexes', () => {
    template.resourceCountIs('AWS::DynamoDB::GlobalTable', 1);
    template.hasResource('AWS::DynamoDB::GlobalTable', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: Match.objectLike({
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: Match.absent(),
        Replicas: [
          Match.objectLike({
            Region: 'eu-central-1',
            DeletionProtectionEnabled: true,
            PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
          }),
        ],
      }),
    });
  });

  it('publishes the table name to SSM', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/hochbeet/prod/garden/table-name',
      Value: { Ref: Match.stringLikeRegexp('^Table') },
    });
  });

  it('migrates the views once with a custom resource keyed on a fixed version', () => {
    template.resourceCountIs('Custom::GardenViewMigration', 1);
    template.hasResourceProperties('Custom::GardenViewMigration', {
      ServiceToken: {
        'Fn::GetAtt': [Match.stringLikeRegexp('^ViewMigrationProviderframeworkonEvent'), 'Arn'],
      },
      MigrationVersion: 1,
    });
    // The version is part of the code, not of the build: a redeploy never migrates again.
    expect(VIEW_MIGRATION_VERSION).toBe(1);
  });

  it('runs the migration function on Node 24 (ARM) with the table name', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Handler: 'index.handler',
      Environment: { Variables: { TABLE_NAME: { Ref: Match.stringLikeRegexp('^Table') } } },
    });
  });

  it('lets the migration function only scan the table and update items', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: Match.stringLikeRegexp('^ViewMigrationFunctionServiceRole'),
      PolicyDocument: {
        Statement: [
          {
            Action: ['dynamodb:Scan', 'dynamodb:UpdateItem'],
            Effect: 'Allow',
            Resource: { 'Fn::GetAtt': [Match.stringLikeRegexp('^Table'), 'Arn'] },
          },
        ],
      },
    });
  });

  it('keeps the logs for a month', () => {
    template.allResourcesProperties('AWS::Logs::LogGroup', { RetentionInDays: 30 });
  });

  it('has no unacknowledged cdk-nag AwsSolutions findings', () => {
    expect(nagViolations).toEqual([]);
  });
});

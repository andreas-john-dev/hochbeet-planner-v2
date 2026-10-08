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

  it('has no unacknowledged cdk-nag AwsSolutions findings', () => {
    expect(nagViolations).toEqual([]);
  });
});

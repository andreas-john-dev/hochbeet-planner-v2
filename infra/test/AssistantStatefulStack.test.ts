import { Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { AssistantStatefulStack } from '../lib/assistant/AssistantStatefulStack';
import { createApp, env, stage, synthAndCollectNagViolations } from './helpers';

describe('AssistantStatefulStack', () => {
  let stack: AssistantStatefulStack;
  let template: Template;
  let nagViolations: string[];

  beforeAll(() => {
    const { app, outdir } = createApp();
    stack = new AssistantStatefulStack(app, 'Prod-AssistantStateful', { env, stage });
    nagViolations = synthAndCollectNagViolations(app, outdir);
    template = Template.fromStack(stack);
  });

  it('keeps the quota counters in a retained on-demand table with TTL', () => {
    expect(stack.terminationProtection).toBe(true);
    template.hasResource('AWS::DynamoDB::GlobalTable', {
      DeletionPolicy: 'Retain',
      Properties: {
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
        ],
        Replicas: [
          {
            Region: 'eu-central-1',
            DeletionProtectionEnabled: true,
            PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
          },
        ],
      },
    });
  });

  it('publishes the table name for the runtime', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/hochbeet/prod/assistant/quota-table-name',
    });
  });

  it('has no unacknowledged cdk-nag AwsSolutions findings', () => {
    expect(nagViolations).toEqual([]);
  });
});

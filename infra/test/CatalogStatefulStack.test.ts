import { seedVersion } from '@hochbeet/catalog-service';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { CatalogStatefulStack } from '../lib/catalog/CatalogStatefulStack';
import { createApp, env, stage, synthAndCollectNagViolations } from './helpers';

function synthStack() {
  const { app, outdir } = createApp();
  const stack = new CatalogStatefulStack(app, 'Prod-CatalogStateful', { env, stage });
  const nagViolations = synthAndCollectNagViolations(app, outdir);
  return { stack, template: Template.fromStack(stack), nagViolations };
}

describe('CatalogStatefulStack', () => {
  let stack: CatalogStatefulStack;
  let template: Template;
  let nagViolations: string[];

  beforeAll(() => {
    ({ stack, template, nagViolations } = synthStack());
  });

  it('enables termination protection', () => {
    expect(stack.terminationProtection).toBe(true);
  });

  it('creates a retained on-demand table with PITR and deletion protection', () => {
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

  it('has the publication index GSI1', () => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    });
  });

  it('publishes the table name to SSM', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/hochbeet/prod/catalog/table-name',
      Value: { Ref: Match.stringLikeRegexp('^Table') },
    });
  });

  it('seeds the table with a custom resource keyed on the seed version', () => {
    template.resourceCountIs('Custom::CatalogSeed', 1);
    template.hasResourceProperties('Custom::CatalogSeed', {
      ServiceToken: {
        'Fn::GetAtt': [Match.stringLikeRegexp('^SeedProviderframeworkonEvent'), 'Arn'],
      },
      SeedVersion: seedVersion(),
    });
  });

  it('keeps the seed properties stable between synths, so a redeploy does not reseed', () => {
    const again = synthStack().template;
    const props = (t: Template) => Object.values(t.findResources('Custom::CatalogSeed'))[0];
    expect(props(again)).toEqual(props(template));
  });

  it('runs the seed function on Node 24 (ARM) with the table name', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Handler: 'index.handler',
      Environment: { Variables: { TABLE_NAME: { Ref: Match.stringLikeRegexp('^Table') } } },
    });
  });

  it('lets the seed function only put items into the table', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: Match.stringLikeRegexp('^SeedFunctionServiceRole'),
      PolicyDocument: {
        Statement: [
          {
            Action: 'dynamodb:PutItem',
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

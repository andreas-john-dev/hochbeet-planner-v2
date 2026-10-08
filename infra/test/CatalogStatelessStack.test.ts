import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { CatalogStatelessStack } from '../lib/catalog/CatalogStatelessStack';
import { createApp, env, stage, synthAndCollectNagViolations } from './helpers';

const ssmParam = (name: string) => ({
  Ref: Match.stringLikeRegexp(`^SsmParameterValue${name.replaceAll('/', '').replaceAll('-', '')}`),
});

describe('CatalogStatelessStack', () => {
  let template: Template;
  let nagViolations: string[];

  beforeAll(() => {
    const { app, outdir } = createApp();
    const stack = new CatalogStatelessStack(app, 'Prod-CatalogStateless', { env, stage });
    nagViolations = synthAndCollectNagViolations(app, outdir);
    template = Template.fromStack(stack);
  });

  it('reads table and user pool from SSM', () => {
    const defaults = Object.values(
      template.toJSON().Parameters as Record<string, { Default?: string }>,
    )
      .map((p) => p.Default)
      .filter(Boolean);
    expect(defaults).toEqual(
      expect.arrayContaining([
        '/hochbeet/prod/catalog/table-name',
        '/hochbeet/prod/shared/user-pool-id',
        '/hochbeet/prod/shared/user-pool-client-id',
      ]),
    );
  });

  it('runs the Lambdalith on Node 24 (ARM) with the table name', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Handler: 'index.handler',
      Environment: {
        Variables: {
          TABLE_NAME: ssmParam('hochbeet/prod/catalog/table-name'),
          NODE_OPTIONS: '--enable-source-maps',
        },
      },
    });
  });

  it('lets the function only read from the catalog table', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: ['dynamodb:Query', 'dynamodb:GetItem'],
            Effect: 'Allow',
            Resource: {
              'Fn::Join': ['', Match.arrayWith([ssmParam('hochbeet/prod/catalog/table-name')])],
            },
          },
        ],
      },
    });
  });

  it('protects every route with the Cognito JWT authorizer', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
      JwtConfiguration: {
        Audience: [ssmParam('hochbeet/prod/shared/user-pool-client-id')],
        Issuer: {
          'Fn::Join': [
            '',
            [
              'https://cognito-idp.eu-central-1.amazonaws.com/',
              ssmParam('hochbeet/prod/shared/user-pool-id'),
            ],
          ],
        },
      },
    });
    const routes = Object.values(template.findResources('AWS::ApiGatewayV2::Route'));
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      Properties: { RouteKey: 'ANY /api/catalog/{proxy+}', AuthorizationType: 'JWT' },
    });
  });

  it('logs access and throttles the default stage', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: '$default',
      AutoDeploy: true,
      AccessLogSettings: Match.objectLike({ Format: Match.stringLikeRegexp('requestId') }),
      DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 40 },
    });
    template.allResourcesProperties('AWS::Logs::LogGroup', { RetentionInDays: 30 });
  });

  it('publishes the API domain for CloudFront', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/hochbeet/prod/catalog/api-domain',
      Value: {
        'Fn::Join': [
          '',
          [
            { Ref: Match.stringLikeRegexp('^Api') },
            '.execute-api.eu-central-1.',
            { Ref: 'AWS::URLSuffix' },
          ],
        ],
      },
    });
  });

  it('has no unacknowledged cdk-nag AwsSolutions findings', () => {
    expect(nagViolations).toEqual([]);
  });
});

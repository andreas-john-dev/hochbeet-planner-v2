import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { AssistantStack } from '../lib/assistant/AssistantStack';
import { createApp, env, stage, synthAndCollectNagViolations } from './helpers';

const ssmParam = (name: string) => ({
  Ref: Match.stringLikeRegexp(`^SsmParameterValue${name.replaceAll('/', '').replaceAll('-', '')}`),
});

/** Stand-in for the built agent (agents/bed-assistant/dist). */
function fakeAgentCode() {
  const dir = mkdtempSync(join(tmpdir(), 'agent-'));
  writeFileSync(join(dir, 'main.py'), 'print("agent")\n');
  return dir;
}

describe('AssistantStack', () => {
  let template: Template;
  let nagViolations: string[];

  beforeAll(() => {
    const { app, outdir } = createApp();
    const stack = new AssistantStack(app, 'Prod-Assistant', {
      env,
      stage,
      agentCodePath: fakeAgentCode(),
    });
    nagViolations = synthAndCollectNagViolations(app, outdir);
    template = Template.fromStack(stack);
  });

  it('runs the Python agent as code deployment on Python 3.13', () => {
    template.hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
      AgentRuntimeName: 'prod_bed_assistant',
      AgentRuntimeArtifact: {
        CodeConfiguration: Match.objectLike({ EntryPoint: ['main.py'], Runtime: 'PYTHON_3_13' }),
      },
      EnvironmentVariables: {
        MODEL_ID: stage.assistant.modelId,
        QUOTA_TABLE: ssmParam('hochbeet/prod/assistant/quota-table-name'),
        DAILY_LIMIT: '20',
        MAX_TOKENS: '1024',
        MAX_INPUT_CHARS: '2000',
        ALLOWED_GROUPS: 'ai-testers,admins',
      },
    });
  });

  it('only lets ID tokens of the app client and the allowed groups through', () => {
    template.hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
      AuthorizerConfiguration: {
        CustomJWTAuthorizer: {
          DiscoveryUrl: {
            'Fn::Join': [
              '',
              [
                'https://cognito-idp.eu-central-1.amazonaws.com/',
                ssmParam('hochbeet/prod/shared/user-pool-id'),
                '/.well-known/openid-configuration',
              ],
            ],
          },
          AllowedAudience: [ssmParam('hochbeet/prod/shared/user-pool-client-id')],
          CustomClaims: [
            {
              InboundTokenClaimName: 'cognito:groups',
              InboundTokenClaimValueType: 'STRING_ARRAY',
              AuthorizingClaimMatchValue: {
                ClaimMatchOperator: 'CONTAINS_ANY',
                ClaimMatchValue: { MatchValueStringList: ['ai-testers', 'admins'] },
              },
            },
          ],
        },
      },
      // The agent reads the caller from the verified token.
      RequestHeaderConfiguration: { RequestHeaderAllowlist: ['Authorization'] },
    });
  });

  it('lets the runtime call exactly the configured model and count questions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            Resource: [
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    `:bedrock:eu-central-1:123456789012:inference-profile/${stage.assistant.modelId}`,
                  ],
                ],
              },
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    `:bedrock:*::foundation-model/${stage.assistant.foundationModelId}`,
                  ],
                ],
              },
            ],
          }),
          Match.objectLike({ Action: 'dynamodb:UpdateItem' }),
        ]),
      },
    });
    // No broad model access and no Marketplace rights: the model is subscribed once by hand.
    const actions = Object.values(template.findResources('AWS::IAM::Policy')).flatMap((p) =>
      (
        p as { Properties: { PolicyDocument: { Statement: { Action: string | string[] }[] } } }
      ).Properties.PolicyDocument.Statement.flatMap((st) => st.Action),
    );
    expect(actions.filter((a) => a.startsWith('bedrock:'))).toEqual([
      'bedrock:InvokeModel',
      'bedrock:InvokeModelWithResponseStream',
    ]);
    expect(actions.some((a) => a.startsWith('aws-marketplace:'))).toBe(false);
  });

  it('traces the runtime and writes usage logs', () => {
    template.resourceCountIs('AWS::Logs::Delivery', 2);
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/vendedlogs/bedrock-agentcore/prod-bed-assistant-usage',
      RetentionInDays: 30,
    });
  });

  it('publishes the runtime ARN for the frontend and the smoke test', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/hochbeet/prod/assistant/runtime-arn',
    });
    template.hasOutput('RuntimeArn', {});
  });

  it('has no unacknowledged cdk-nag AwsSolutions findings', () => {
    expect(nagViolations).toEqual([]);
  });
});

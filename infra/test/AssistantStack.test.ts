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
        GATEWAY_URL: { 'Fn::GetAtt': [Match.stringLikeRegexp('^Gateway'), 'GatewayUrl'] },
        MAX_TOOL_CALLS: '6',
        SUGGESTION_ROUNDS: '2',
        MEMORY_ID: ssmParam('hochbeet/prod/assistant/memory-id'),
        HISTORY_MESSAGES: '20',
        TRACING: 'true',
        SERVICE_NAME: 'prod_bed_assistant',
      },
    });
  });

  it('may read, write and delete events and records of exactly the one memory', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Effect: 'Allow',
            Action: [
              'bedrock-agentcore:CreateEvent',
              'bedrock-agentcore:GetEvent',
              'bedrock-agentcore:ListEvents',
              'bedrock-agentcore:DeleteEvent',
              'bedrock-agentcore:ListSessions',
              'bedrock-agentcore:RetrieveMemoryRecords',
              'bedrock-agentcore:ListMemoryRecords',
              'bedrock-agentcore:BatchDeleteMemoryRecords',
            ],
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':bedrock-agentcore:eu-central-1:123456789012:memory/',
                  ssmParam('hochbeet/prod/assistant/memory-id'),
                ],
              ],
            },
          },
        ]),
      },
    });
    // Never the memory's control plane (creating, changing or deleting the memory itself).
    const actions = Object.values(template.findResources('AWS::IAM::Policy')).flatMap((p) =>
      (
        p as { Properties: { PolicyDocument: { Statement: { Action: string | string[] }[] } } }
      ).Properties.PolicyDocument.Statement.flatMap((st) => st.Action),
    );
    expect(actions.filter((a) => /Memory$|MemoryStrateg/.test(a))).toEqual([]);
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

  it('writes usage logs and delivers traces to X-Ray', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/vendedlogs/bedrock-agentcore/prod-bed-assistant-usage',
      RetentionInDays: 30,
    });
    template.hasResourceProperties('AWS::Logs::DeliverySource', { LogType: 'USAGE_LOGS' });
    template.hasResourceProperties('AWS::Logs::DeliverySource', { LogType: 'TRACES' });
    template.hasResourceProperties('AWS::Logs::DeliveryDestination', {
      DeliveryDestinationType: 'XRAY',
    });
    template.resourceCountIs('AWS::Logs::Delivery', 2);
    // Only the log delivery service may write segments, only for this runtime.
    const document = JSON.stringify(template.findResources('AWS::XRay::ResourcePolicy'));
    expect(document).toContain('xray:PutTraceSegments');
    expect(document).toContain('delivery.logs.amazonaws.com');
    expect(document).toMatch(/logs:LogGeneratingResourceArns.*Runtime[0-9A-F]+.*AgentRuntimeArn/);
  });

  it('publishes the gateway URL for the model comparison', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/hochbeet/prod/assistant/gateway-url',
      Value: { 'Fn::GetAtt': [Match.stringLikeRegexp('^Gateway'), 'GatewayUrl'] },
    });
  });

  it('publishes the runtime ARN for the frontend and the smoke test', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/hochbeet/prod/assistant/runtime-arn',
    });
    template.hasOutput('RuntimeArn', {});
  });

  it('offers the tools through an MCP gateway for the same ID tokens and groups', () => {
    template.hasResourceProperties('AWS::BedrockAgentCore::Gateway', {
      Name: 'prod-bed-assistant-tools',
      ProtocolType: 'MCP',
      // No semantic tool search: it would add embedding costs for four tools.
      ProtocolConfiguration: {
        Mcp: { SupportedVersions: ['2025-03-26', '2025-06-18'], SearchType: Match.absent() },
      },
      AuthorizerType: 'CUSTOM_JWT',
      AuthorizerConfiguration: {
        CustomJWTAuthorizer: Match.objectLike({
          AllowedAudience: [ssmParam('hochbeet/prod/shared/user-pool-client-id')],
          CustomClaims: [
            Match.objectLike({
              InboundTokenClaimName: 'cognito:groups',
              AuthorizingClaimMatchValue: {
                ClaimMatchOperator: 'CONTAINS_ANY',
                ClaimMatchValue: { MatchValueStringList: ['ai-testers', 'admins'] },
              },
            }),
          ],
        }),
      },
      // The interceptor needs the Authorization header to hand the token to the tools.
      InterceptorConfigurations: [
        {
          InterceptionPoints: ['REQUEST'],
          InputConfiguration: { PassRequestHeaders: true },
          Interceptor: {
            Lambda: { Arn: { 'Fn::GetAtt': [Match.stringLikeRegexp('^Interceptor'), 'Arn'] } },
          },
        },
      ],
    });
  });

  it('declares the read-only tools with German descriptions on one Lambda target', () => {
    template.resourceCountIs('AWS::BedrockAgentCore::GatewayTarget', 1);
    const [target] = Object.values(template.findResources('AWS::BedrockAgentCore::GatewayTarget'));
    const lambdaTarget = (
      target as {
        Properties: {
          Name: string;
          TargetConfiguration: {
            Mcp: {
              Lambda: {
                LambdaArn: unknown;
                ToolSchema: {
                  InlinePayload: {
                    Name: string;
                    Description: string;
                    InputSchema: { Required?: string[] };
                  }[];
                };
              };
            };
          };
        };
      }
    ).Properties;
    expect(lambdaTarget.Name).toBe('garden');
    const tools = lambdaTarget.TargetConfiguration.Mcp.Lambda.ToolSchema.InlinePayload;
    expect(tools.map((t) => t.Name)).toEqual([
      'list_beds',
      'get_bed',
      'find_plants',
      'evaluate_bed',
    ]);
    expect(tools.find((t) => t.Name === 'get_bed')?.InputSchema.Required).toEqual(['bedId']);
    // evaluate_bed also checks planned plantings (suggestions) before they exist.
    expect(JSON.stringify(tools.find((t) => t.Name === 'evaluate_bed')?.InputSchema)).toContain(
      '"candidates":{"Description"',
    );
    for (const tool of tools) expect(tool.Description).toMatch(/[äöüß]|Beet/);
    // Nothing that writes: names only read, list, find or evaluate.
    expect(tools.every((t) => /^(list|get|find|evaluate)_/.test(t.Name))).toBe(true);
  });

  it('lets the tools read through the public API and nothing else in AWS', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Description: Match.stringLikeRegexp('Read-only tools'),
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Environment: {
        Variables: Match.objectLike({ API_BASE_URL: `https://${stage.domain.name}` }),
      },
    });
    // The gateway may only invoke the tool and interceptor functions.
    const gatewayPolicy = Object.entries(template.findResources('AWS::IAM::Policy')).find(([id]) =>
      id.startsWith('GatewayServiceRole'),
    )?.[1] as { Properties: { PolicyDocument: { Statement: { Action: string }[] } } } | undefined;
    expect(gatewayPolicy?.Properties.PolicyDocument.Statement.map((s) => s.Action)).toEqual([
      'lambda:InvokeFunction',
      'lambda:InvokeFunction',
    ]);
    // The functions themselves get no policy beyond their logs (no table or model access).
    const functionPolicies = Object.keys(template.findResources('AWS::IAM::Policy')).filter((id) =>
      /^(Tools|Interceptor)/.test(id),
    );
    expect(functionPolicies).toEqual([]);
    template.hasOutput('GatewayUrl', {});
  });

  it('has no unacknowledged cdk-nag AwsSolutions findings', () => {
    expect(nagViolations).toEqual([]);
  });
});

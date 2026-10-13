import { fileURLToPath } from 'node:url';
import {
  TOOL_DEFINITIONS,
  toolInputJsonSchemas,
  type ToolJsonSchema,
} from '@hochbeet/assistant-tools';
import { MAX_ASSISTANT_MESSAGE_CHARS } from '@hochbeet/contracts';
import {
  type CfnElement,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  Token,
  Validations,
} from 'aws-cdk-lib';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';

export interface AssistantStackProps extends StackProps {
  readonly stage: StageConfig;
  /** Built agent (agents/bed-assistant/dist); tests pass a stand-in. */
  readonly agentCodePath?: string;
}

const DEFAULT_AGENT_CODE = fileURLToPath(
  new URL('../../../agents/bed-assistant/dist', import.meta.url),
);
const toolsSource = (file: string) =>
  fileURLToPath(new URL(`../../../services/assistant-tools/src/${file}`, import.meta.url));

/** Name of the gateway target; the gateway names its tools `garden___<tool>`. */
export const TOOLS_TARGET_NAME = 'garden';

/** JSON schema of a tool input as the gateway's inline tool schema (types and descriptions). */
function schemaDefinition(schema: ToolJsonSchema): agentcore.SchemaDefinition {
  return {
    type: agentcore.SchemaDefinitionType.of(schema.type ?? 'object'),
    ...(schema.description ? { description: schema.description } : {}),
    ...(schema.items ? { items: schemaDefinition(schema.items) } : {}),
    ...(schema.properties
      ? {
          properties: Object.fromEntries(
            Object.entries(schema.properties).map(([key, value]) => [key, schemaDefinition(value)]),
          ),
        }
      : {}),
    ...(schema.required?.length ? { required: schema.required } : {}),
  };
}

/** The read-only tools of services/assistant-tools, with their German descriptions. */
export function gatewayToolDefinitions(): agentcore.ToolDefinition[] {
  const inputs = toolInputJsonSchemas();
  return Object.entries(TOOL_DEFINITIONS).map(([name, { description }]) => ({
    name,
    description,
    inputSchema: schemaDefinition(inputs[name as keyof typeof inputs]),
  }));
}

/**
 * The Beet-Assistent on the AgentCore Runtime: Python code (Strands Agents) deployed as zip,
 * reachable only with a Cognito ID token of the groups in the stage config. The role may
 * call exactly the configured model and count questions in the quota table.
 *
 * Its tools come from an AgentCore Gateway (MCP) that accepts the same ID tokens. A request
 * interceptor hands the caller's token to the tool Lambda, which reads beds and catalogue
 * through the public API with it: the services keep taking the userId from `sub`.
 */
export class AssistantStack extends Stack {
  readonly runtime: agentcore.Runtime;
  readonly gateway: agentcore.Gateway;
  readonly tools: NodejsFunction;
  readonly interceptor: NodejsFunction;
  private readonly stageModel: string;

  constructor(scope: Construct, id: string, props: AssistantStackProps) {
    super(scope, id, props);
    const { assistant } = props.stage;
    this.stageModel = assistant.foundationModelId;
    const names = ssmParameters(props.stage);
    const read = (name: string) => ssm.StringParameter.valueForStringParameter(this, name);
    const userPoolId = read(names.userPoolId);
    const userPoolClientId = read(names.userPoolClientId);
    const quotaTableName = read(names.assistantQuotaTableName);
    const memoryId = read(names.assistantMemoryId);

    // Only ID tokens of this app's client and of the allowed groups get through.
    const authorizer = agentcore.RuntimeAuthorizerConfiguration.usingJWT(
      `https://cognito-idp.${this.region}.amazonaws.com/${userPoolId}/.well-known/openid-configuration`,
      undefined,
      [userPoolClientId],
      undefined,
      [
        agentcore.RuntimeCustomClaim.withStringArrayValue(
          'cognito:groups',
          [...assistant.allowedGroups],
          agentcore.CustomClaimOperator.CONTAINS_ANY,
        ),
      ],
    );

    const lambdaDefaults = {
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      bundling: { format: OutputFormat.ESM, minify: true, sourceMap: true },
    };
    const logGroup = (id: string) =>
      new logs.LogGroup(this, id, {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      });
    this.tools = new NodejsFunction(this, 'Tools', {
      ...lambdaDefaults,
      entry: toolsSource('lambda.ts'),
      description: 'Read-only tools of the Beet-Assistent (AgentCore Gateway target)',
      timeout: Duration.seconds(15),
      environment: {
        // CloudFront routes /api/* to the services, like for the app.
        API_BASE_URL: `https://${props.stage.domain.name}`,
        NODE_OPTIONS: '--enable-source-maps',
      },
      logGroup: logGroup('ToolsLogs'),
    });
    this.interceptor = new NodejsFunction(this, 'Interceptor', {
      ...lambdaDefaults,
      entry: toolsSource('interceptor.ts'),
      description: 'Hands the caller token to the assistant tools (gateway request interceptor)',
      timeout: Duration.seconds(5),
      logGroup: logGroup('InterceptorLogs'),
    });

    this.gateway = new agentcore.Gateway(this, 'Gateway', {
      gatewayName: `${props.stage.name}-bed-assistant-tools`,
      description: 'Read-only tools of the Beet-Assistent',
      // Four tools need no semantic tool search, which would add embedding costs.
      protocolConfiguration: agentcore.GatewayProtocol.mcp({
        supportedVersions: [
          agentcore.MCPProtocolVersion.MCP_2025_03_26,
          agentcore.MCPProtocolVersion.MCP_2025_06_18,
        ],
      }),
      // The same ID tokens as the runtime: this app's client and the allowed groups only.
      authorizerConfiguration: agentcore.GatewayAuthorizer.usingCustomJwt({
        discoveryUrl: `https://cognito-idp.${this.region}.amazonaws.com/${userPoolId}/.well-known/openid-configuration`,
        allowedAudience: [userPoolClientId],
        customClaims: [
          agentcore.GatewayCustomClaim.withStringArrayValue(
            'cognito:groups',
            [...assistant.allowedGroups],
            agentcore.CustomClaimOperator.CONTAINS_ANY,
          ),
        ],
      }),
      interceptorConfigurations: [
        agentcore.LambdaInterceptor.forRequest(this.interceptor, { passRequestHeaders: true }),
      ],
    });
    this.gateway.addLambdaTarget('GardenTools', {
      gatewayTargetName: TOOLS_TARGET_NAME,
      description: 'Beds catalogue and rule engine of the signed-in user',
      lambdaFunction: this.tools,
      toolSchema: agentcore.ToolSchema.fromInline(gatewayToolDefinitions()),
    });
    const gatewayUrl = this.gateway.gatewayUrl;
    if (!gatewayUrl) throw new Error('The gateway has no URL attribute.');

    const usageLogs = new logs.LogGroup(this, 'UsageLogs', {
      logGroupName: `/aws/vendedlogs/bedrock-agentcore/${props.stage.name}-bed-assistant-usage`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.runtime = new agentcore.Runtime(this, 'Runtime', {
      runtimeName: `${props.stage.name}_bed_assistant`,
      description: `Beet-Assistent (${props.stage.name})`,
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromCodeAsset({
        path: props.agentCodePath ?? DEFAULT_AGENT_CODE,
        runtime: agentcore.AgentCoreRuntime.PYTHON_3_13,
        entrypoint: ['main.py'],
      }),
      authorizerConfiguration: authorizer,
      // The agent reads `sub` and the groups from the token the runtime has verified.
      requestHeaderConfiguration: { allowlistedHeaders: ['Authorization'] },
      environmentVariables: {
        MODEL_ID: assistant.modelId,
        QUOTA_TABLE: quotaTableName,
        DAILY_LIMIT: String(assistant.dailyMessageLimit),
        MAX_TOKENS: String(assistant.maxTokens),
        MAX_INPUT_CHARS: String(MAX_ASSISTANT_MESSAGE_CHARS),
        ALLOWED_GROUPS: assistant.allowedGroups.join(','),
        GATEWAY_URL: gatewayUrl,
        MAX_TOOL_CALLS: String(assistant.maxToolCalls),
        SUGGESTION_ROUNDS: String(assistant.suggestionRounds),
        MEMORY_ID: memoryId,
        HISTORY_MESSAGES: String(assistant.historyMessages),
      },
      // X-Ray tracing needs Transaction Search enabled in the account (see docs/architecture.md).
      tracingEnabled: false,
      loggingConfigs: [
        {
          logType: agentcore.LogType.USAGE_LOGS,
          destination: agentcore.LoggingDestination.cloudWatchLogs(usageLogs),
        },
      ],
    });

    // Exactly one model: the EU inference profile and the model it routes to in EU regions.
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:${this.partition}:bedrock:${this.region}:${this.account}:inference-profile/${assistant.modelId}`,
          `arn:${this.partition}:bedrock:*::foundation-model/${assistant.foundationModelId}`,
        ],
      }),
    );
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:UpdateItem'],
        resources: [
          this.formatArn({ service: 'dynamodb', resource: 'table', resourceName: quotaTableName }),
        ],
      }),
    );

    // Memory (T-44): conversations and preferences of all users in one memory; the agent
    // separates them by actor (`sub` from the verified token), IAM cannot per user.
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock-agentcore:CreateEvent',
          'bedrock-agentcore:GetEvent',
          'bedrock-agentcore:ListEvents',
          'bedrock-agentcore:DeleteEvent',
          'bedrock-agentcore:ListSessions',
          'bedrock-agentcore:RetrieveMemoryRecords',
          'bedrock-agentcore:ListMemoryRecords',
          'bedrock-agentcore:BatchDeleteMemoryRecords',
        ],
        resources: [
          this.formatArn({
            service: 'bedrock-agentcore',
            resource: 'memory',
            resourceName: memoryId,
          }),
        ],
      }),
    );

    new ssm.StringParameter(this, 'RuntimeArnParameter', {
      parameterName: names.assistantRuntimeArn,
      stringValue: this.runtime.agentRuntimeArn,
    });
    // Read by the model comparison (workflow assistant-eval.yml, T-45).
    new ssm.StringParameter(this, 'GatewayUrlParameter', {
      parameterName: names.assistantGatewayUrl,
      stringValue: gatewayUrl,
    });
    // Read by the deploy workflow for the smoke test.
    new CfnOutput(this, 'RuntimeArn', {
      key: 'RuntimeArn',
      value: this.runtime.agentRuntimeArn,
      description: 'ARN of the assistant runtime',
    });
    new CfnOutput(this, 'GatewayUrl', {
      key: 'GatewayUrl',
      value: gatewayUrl,
      description: 'MCP endpoint of the assistant tools',
    });

    this.acknowledgeNagFindings();
  }

  /** Accepted cdk-nag findings, documented in docs/architecture.md (section "cdk-nag"). */
  private acknowledgeNagFindings() {
    // cdk-nag names resources as they resolve: placeholders for tokens, literals otherwise.
    const account = Token.isUnresolved(this.account) ? '<AWS::AccountId>' : this.account;
    const forms = (arn: (partition: string) => string) =>
      ['aws', '<AWS::Partition>'].map((partition) => arn(partition));
    const iam5 = (findings: string[], reason: string) => {
      for (const finding of findings) {
        Validations.of(this.runtime).acknowledge({ id: `AwsSolutions-IAM5[${finding}]`, reason });
      }
    };
    iam5(
      forms((p) => `Resource::arn:${p}:bedrock:*::foundation-model/${this.stageModel}`),
      'The EU inference profile routes to the same foundation model in several EU regions, so the model ARN needs a region wildcard.',
    );
    const logs = `logs:${this.region}:${account}:log-group:`;
    iam5(
      [
        ...forms((p) => `Resource::arn:${p}:${logs}/aws/bedrock-agentcore/runtimes/*`),
        ...forms((p) => `Resource::arn:${p}:${logs}*`),
        ...forms((p) => `Resource::arn:${p}:${logs}/aws/bedrock-agentcore/runtimes/*:log-stream:*`),
        ...forms(
          (p) =>
            `Resource::arn:${p}:bedrock-agentcore:${this.region}:${account}:workload-identity-directory/default/workload-identity/*`,
        ),
        'Resource::*',
      ],
      'Generated by the AgentCore Runtime construct for its own logs, traces, metrics and workload identity; scoped by AWS as far as the services allow.',
    );
    for (const fn of [this.tools, this.interceptor]) {
      Validations.of(fn).acknowledge({
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason:
          'The managed basic execution role only allows writing its own CloudWatch logs; the functions need no other AWS access.',
      });
      const logicalId = this.getLogicalId(fn.node.defaultChild as CfnElement);
      Validations.of(this.gateway).acknowledge({
        id: `AwsSolutions-IAM5[Resource::<${logicalId}.Arn>:*]`,
        reason:
          'Generated by the Gateway construct: invoking the tool and interceptor functions includes their versions and aliases.',
      });
    }
    iam5(
      [
        'Action::s3:GetBucket*',
        'Action::s3:GetObject*',
        'Action::s3:List*',
        ...forms((p) => `Resource::arn:${p}:s3:::cdk-hnb659fds-assets-${account}-${this.region}/*`),
      ],
      'Read access to the CDK asset bucket for the agent code zip, granted by the code asset itself.',
    );
  }
}

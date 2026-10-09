import { fileURLToPath } from 'node:url';
import { MAX_ASSISTANT_MESSAGE_CHARS } from '@hochbeet/contracts';
import { CfnOutput, RemovalPolicy, Stack, type StackProps, Token, Validations } from 'aws-cdk-lib';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
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

/**
 * The Beet-Assistent on the AgentCore Runtime: Python code (Strands Agents) deployed as zip,
 * reachable only with a Cognito ID token of the groups in the stage config. The role may
 * call exactly the configured model and count questions in the quota table.
 */
export class AssistantStack extends Stack {
  readonly runtime: agentcore.Runtime;
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
      },
      tracingEnabled: true,
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

    new ssm.StringParameter(this, 'RuntimeArnParameter', {
      parameterName: names.assistantRuntimeArn,
      stringValue: this.runtime.agentRuntimeArn,
    });
    // Read by the deploy workflow for the smoke test.
    new CfnOutput(this, 'RuntimeArn', {
      key: 'RuntimeArn',
      value: this.runtime.agentRuntimeArn,
      description: 'ARN of the assistant runtime',
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

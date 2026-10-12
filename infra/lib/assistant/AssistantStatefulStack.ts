import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';

export interface AssistantStatefulStackProps extends StackProps {
  readonly stage: StageConfig;
}

/**
 * Namespace of the users' preferences in the memory; `{actorId}` is the Cognito `sub`. The
 * agent reads and deletes there (agents/bed-assistant/src/bed_assistant/memory.py).
 */
export const PREFERENCE_NAMESPACE = '/users/{actorId}/preferences';

/**
 * Daily question counters of the assistant (`USER#<sub>`, `DAY#<date>`) and its memory
 * (T-44). Counters expire via TTL two days later; the table itself is retained like all
 * stateful tables. The memory keeps conversation events for a few days and the preferences
 * extracted from them until the user deletes them in the profile.
 */
export class AssistantStatefulStack extends Stack {
  readonly table: dynamodb.TableV2;
  readonly memory: agentcore.Memory;

  constructor(scope: Construct, id: string, props: AssistantStatefulStackProps) {
    super(scope, id, { terminationProtection: true, ...props });
    const names = ssmParameters(props.stage);

    const string = dynamodb.AttributeType.STRING;
    this.table = new dynamodb.TableV2(this, 'QuotaTable', {
      partitionKey: { name: 'PK', type: string },
      sortKey: { name: 'SK', type: string },
      timeToLiveAttribute: 'expiresAt',
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new ssm.StringParameter(this, 'QuotaTableNameParameter', {
      parameterName: names.assistantQuotaTableName,
      stringValue: this.table.tableName,
    });

    // Short-term: conversation events per user and chat. Long-term: only preferences, which
    // the built-in strategy extracts in the background (no summaries, no general facts).
    this.memory = new agentcore.Memory(this, 'Memory', {
      memoryName: `${props.stage.name}_bed_assistant_memory`,
      description: 'Conversations and preferences of the Beet-Assistent users',
      expirationDuration: Duration.days(props.stage.assistant.conversationRetentionDays),
      memoryStrategies: [
        agentcore.MemoryStrategy.usingUserPreference({
          strategyName: 'preferences',
          description: 'Garden preferences of a user such as dislikes, location and sun',
          namespaces: [PREFERENCE_NAMESPACE],
        }),
      ],
    });
    for (const child of this.memory.node.findAll()) {
      if (child instanceof agentcore.CfnMemory) child.applyRemovalPolicy(RemovalPolicy.RETAIN);
    }

    new ssm.StringParameter(this, 'MemoryIdParameter', {
      parameterName: names.assistantMemoryId,
      stringValue: this.memory.memoryId,
    });
  }
}

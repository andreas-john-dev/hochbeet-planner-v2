import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';

export interface AssistantStatefulStackProps extends StackProps {
  readonly stage: StageConfig;
}

/**
 * Daily question counters of the assistant (`USER#<sub>`, `DAY#<date>`). Counters expire via
 * TTL two days later; the table itself is retained like all stateful tables.
 */
export class AssistantStatefulStack extends Stack {
  readonly table: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: AssistantStatefulStackProps) {
    super(scope, id, { terminationProtection: true, ...props });

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
      parameterName: ssmParameters(props.stage).assistantQuotaTableName,
      stringValue: this.table.tableName,
    });
  }
}

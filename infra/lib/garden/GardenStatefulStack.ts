import { gardenTable } from '@hochbeet/garden-service';
import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';

export interface GardenStatefulStackProps extends StackProps {
  readonly stage: StageConfig;
}

/** Garden table with beds and plantings, keyed by user. Retained on delete. */
export class GardenStatefulStack extends Stack {
  readonly table: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: GardenStatefulStackProps) {
    super(scope, id, { terminationProtection: true, ...props });

    const string = dynamodb.AttributeType.STRING;
    this.table = new dynamodb.TableV2(this, 'Table', {
      partitionKey: { name: gardenTable.partitionKey, type: string },
      sortKey: { name: gardenTable.sortKey, type: string },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new ssm.StringParameter(this, 'TableNameParameter', {
      parameterName: ssmParameters(props.stage).gardenTableName,
      stringValue: this.table.tableName,
    });
  }
}

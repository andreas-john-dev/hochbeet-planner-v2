import { fileURLToPath } from 'node:url';
import { gardenTable, VIEW_MIGRATION_VERSION } from '@hochbeet/garden-service';
import {
  CustomResource,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  Validations,
} from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cr from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';

const viewMigrationEntry = fileURLToPath(
  new URL('../../../services/garden/src/migration/handler.ts', import.meta.url),
);

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

    this.addViewMigration();
  }

  /**
   * One-off custom resource (T-73): users with data keep the expert view. Its properties hold
   * a fixed version, so it runs once on the deploy that adds it and never again.
   */
  private addViewMigration() {
    const migrationFunction = new NodejsFunction(this, 'ViewMigrationFunction', {
      entry: viewMigrationEntry,
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.minutes(5),
      environment: { TABLE_NAME: this.table.tableName },
      logGroup: new logs.LogGroup(this, 'ViewMigrationFunctionLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling: { format: OutputFormat.ESM, minify: true, sourceMap: true },
    });
    // Scan for the users with data, UpdateItem for their settings; nothing else.
    migrationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Scan', 'dynamodb:UpdateItem'],
        resources: [this.table.tableArn],
      }),
    );

    const provider = new cr.Provider(this, 'ViewMigrationProvider', {
      onEventHandler: migrationFunction,
      logGroup: new logs.LogGroup(this, 'ViewMigrationProviderLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    new CustomResource(this, 'ViewMigration', {
      serviceToken: provider.serviceToken,
      resourceType: 'Custom::GardenViewMigration',
      properties: { MigrationVersion: VIEW_MIGRATION_VERSION },
    });

    this.acknowledgeNagFindings(migrationFunction, provider);
  }

  /** Accepted cdk-nag findings, documented in docs/architecture/infrastructure.md (section "cdk-nag"). */
  private acknowledgeNagFindings(migrationFunction: NodejsFunction, provider: cr.Provider) {
    const basicExecutionRole =
      'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]';
    Validations.of(migrationFunction).acknowledge({
      id: basicExecutionRole,
      reason:
        'The managed basic execution role only allows writing its own CloudWatch logs; the migration function has no other managed policy.',
    });
    const fnArn = this.resolve(migrationFunction.functionArn) as {
      'Fn::GetAtt': [string, string];
    };
    const cdkManaged =
      'CDK-managed custom resource provider framework; its role and invoke permission are set by aws-cdk-lib.';
    for (const id of [
      basicExecutionRole,
      `AwsSolutions-IAM5[Resource::<${fnArn['Fn::GetAtt'][0]}.Arn>:*]`,
    ]) {
      Validations.of(provider).acknowledge({ id, reason: cdkManaged });
    }
  }
}

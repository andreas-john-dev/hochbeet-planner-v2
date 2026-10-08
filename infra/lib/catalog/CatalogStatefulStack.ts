import { fileURLToPath } from 'node:url';
import { catalogTable, seedVersion } from '@hochbeet/catalog-service';
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

const seedHandlerEntry = fileURLToPath(
  new URL('../../../services/catalog/src/seed/handler.ts', import.meta.url),
);

export interface CatalogStatefulStackProps extends StackProps {
  readonly stage: StageConfig;
}

/** Catalog table with the publication index, seeded with the start catalogue. Retained on delete. */
export class CatalogStatefulStack extends Stack {
  readonly table: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: CatalogStatefulStackProps) {
    super(scope, id, { terminationProtection: true, ...props });

    const string = dynamodb.AttributeType.STRING;
    const index = catalogTable.publicationIndex;
    this.table = new dynamodb.TableV2(this, 'Table', {
      partitionKey: { name: catalogTable.partitionKey, type: string },
      sortKey: { name: catalogTable.sortKey, type: string },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          indexName: index.name,
          partitionKey: { name: index.partitionKey, type: string },
          sortKey: { name: index.sortKey, type: string },
        },
      ],
    });

    new ssm.StringParameter(this, 'TableNameParameter', {
      parameterName: ssmParameters(props.stage).catalogTableName,
      stringValue: this.table.tableName,
    });

    this.addSeed();
  }

  /** Custom resource that writes the start catalogue; runs again whenever the seed changes. */
  private addSeed() {
    const seedFunction = new NodejsFunction(this, 'SeedFunction', {
      entry: seedHandlerEntry,
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.minutes(2),
      environment: { TABLE_NAME: this.table.tableName },
      logGroup: new logs.LogGroup(this, 'SeedFunctionLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling: { format: OutputFormat.ESM, minify: true, sourceMap: true },
    });
    // Only PutItem on the table itself; `table.grant` would add the indexes with a wildcard.
    seedFunction.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['dynamodb:PutItem'], resources: [this.table.tableArn] }),
    );

    const provider = new cr.Provider(this, 'SeedProvider', {
      onEventHandler: seedFunction,
      logGroup: new logs.LogGroup(this, 'SeedProviderLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    new CustomResource(this, 'Seed', {
      serviceToken: provider.serviceToken,
      resourceType: 'Custom::CatalogSeed',
      // A new seed version changes the properties and triggers an update on deploy.
      properties: { SeedVersion: seedVersion() },
    });

    this.acknowledgeNagFindings(seedFunction, provider);
  }

  /** Accepted cdk-nag findings, documented in docs/architecture.md (section "cdk-nag"). */
  private acknowledgeNagFindings(seedFunction: NodejsFunction, provider: cr.Provider) {
    const basicExecutionRole =
      'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]';
    Validations.of(seedFunction).acknowledge({
      id: basicExecutionRole,
      reason:
        'The managed basic execution role only allows writing its own CloudWatch logs; the seed function has no other managed policy.',
    });
    const fnArn = this.resolve(seedFunction.functionArn) as { 'Fn::GetAtt': [string, string] };
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

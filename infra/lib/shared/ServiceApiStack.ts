import { Duration, RemovalPolicy, Stack, type StackProps, Validations } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';

export interface ServiceApiStackProps extends StackProps {
  readonly stage: StageConfig;
  /** Shown in the API description, e.g. `Catalog`. */
  readonly title: string;
  /** Lambda entry file of the service's Lambdalith. */
  readonly entry: string;
  /** Route prefix of the service, e.g. `/api/catalog`; CloudFront forwards it unchanged. */
  readonly basePath: string;
  /** SSM parameter with the service's table name. */
  readonly tableNameParameter: string;
  /** SSM parameter this stack writes the API domain to, read by the frontend stack. */
  readonly apiDomainParameter: string;
  /** Secondary indexes the service may query. */
  readonly indexNames?: readonly string[];
}

/**
 * Stateless part of a service: its Hono Lambdalith behind an HTTP API with Cognito JWT
 * authorizer. Reads user pool and table from SSM; publishes the API domain for CloudFront.
 */
export class ServiceApiStack extends Stack {
  readonly api: apigw.HttpApi;
  readonly handler: NodejsFunction;

  constructor(scope: Construct, id: string, props: ServiceApiStackProps) {
    super(scope, id, props);
    const names = ssmParameters(props.stage);
    const read = (name: string) => ssm.StringParameter.valueForStringParameter(this, name);
    const tableName = read(props.tableNameParameter);
    const userPoolId = read(names.userPoolId);
    const userPoolClientId = read(names.userPoolClientId);

    this.handler = new NodejsFunction(this, 'Handler', {
      entry: props.entry,
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: { TABLE_NAME: tableName, NODE_OPTIONS: '--enable-source-maps' },
      logGroup: new logs.LogGroup(this, 'HandlerLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling: { format: OutputFormat.ESM, minify: true, sourceMap: true },
    });
    // Item access on the table only, no scans and no index wildcard.
    const tableArn = this.formatArn({
      service: 'dynamodb',
      resource: 'table',
      resourceName: tableName,
    });
    this.handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:Query',
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
        ],
        resources: [tableArn],
      }),
    );
    // Queries on named indexes only, e.g. the admin queue of the catalog.
    if (props.indexNames?.length) {
      this.handler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['dynamodb:Query'],
          resources: props.indexNames.map((index) => `${tableArn}/index/${index}`),
        }),
      );
    }

    const authorizer = new HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPoolId}`,
      { jwtAudience: [userPoolClientId] },
    );

    this.api = new apigw.HttpApi(this, 'Api', {
      description: `${props.title} API (${props.stage.name})`,
      defaultAuthorizer: authorizer,
    });
    this.api.addRoutes({
      path: `${props.basePath}/{proxy+}`,
      methods: [apigw.HttpMethod.ANY],
      integration: new HttpLambdaIntegration('HandlerIntegration', this.handler),
    });
    this.configureStage();

    new ssm.StringParameter(this, 'ApiDomainParameter', {
      parameterName: props.apiDomainParameter,
      stringValue: `${this.api.apiId}.execute-api.${this.region}.${this.urlSuffix}`,
    });

    this.acknowledgeNagFindings();
  }

  /** Access logs and a throttle on the default stage; keeps cost and abuse in check. */
  private configureStage() {
    const accessLogs = new logs.LogGroup(this, 'ApiAccessLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const stage = this.api.defaultStage?.node.defaultChild as apigw.CfnStage;
    stage.accessLogSettings = {
      destinationArn: accessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        ip: '$context.identity.sourceIp',
        method: '$context.httpMethod',
        path: '$context.path',
        status: '$context.status',
        latencyMs: '$context.responseLatency',
        userId: '$context.authorizer.claims.sub',
        error: '$context.authorizer.error',
      }),
    };
    stage.defaultRouteSettings = { throttlingRateLimit: 20, throttlingBurstLimit: 40 };
  }

  /** Accepted cdk-nag findings, documented in docs/architecture.md (section "cdk-nag"). */
  private acknowledgeNagFindings() {
    Validations.of(this.handler).acknowledge({
      id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
      reason:
        'The managed basic execution role only allows writing its own CloudWatch logs; table access is a separate least-privilege policy.',
    });
  }
}

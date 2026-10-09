import {
  CfnCondition,
  CfnOutput,
  CfnParameter,
  CfnResource,
  CustomResource,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  type StackProps,
  Validations,
} from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';

/**
 * Handler of Custom::SmokeUserPassword. Runs with the SDK of the Lambda runtime and answers
 * CloudFormation itself. It never logs the event, because the event contains the password.
 */
const SET_PASSWORD_HANDLER = `
const { CognitoIdentityProviderClient, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const client = new CognitoIdentityProviderClient({});
exports.handler = async (event) => {
  let status = 'SUCCESS';
  let reason = 'OK';
  try {
    if (event.RequestType !== 'Delete') {
      const { UserPoolId, Username, Password } = event.ResourceProperties;
      await client.send(new AdminSetUserPasswordCommand({ UserPoolId, Username, Password, Permanent: true }));
    }
  } catch (error) {
    status = 'FAILED';
    reason = String(error.name) + ': ' + String(error.message);
    console.error('Setting the smoke user password failed:', reason);
  }
  const body = JSON.stringify({
    Status: status,
    Reason: reason,
    PhysicalResourceId: 'smoke-user-password',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  });
  await fetch(event.ResponseURL, { method: 'PUT', headers: { 'content-type': '' }, body });
};
`;

export interface SharedStatefulStackProps extends StackProps {
  readonly stage: StageConfig;
}

/** Cognito user pool shared by all services. Stateful: retained on delete. */
export class SharedStatefulStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: SharedStatefulStackProps) {
    super(scope, id, { terminationProtection: true, ...props });

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `hochbeet-${props.stage.name}`,
      featurePlan: cognito.FeaturePlan.LITE,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      email: cognito.UserPoolEmail.withCognito(),
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient('SpaClient', {
      userPoolClientName: 'spa',
      generateSecret: false,
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
    });

    new cognito.UserPoolGroup(this, 'AdminsGroup', {
      userPool: this.userPool,
      groupName: 'admins',
      description: 'Admins maintain global plants and the publication queue',
    });

    const names = ssmParameters(props.stage);
    new ssm.StringParameter(this, 'UserPoolIdParameter', {
      parameterName: names.userPoolId,
      stringValue: this.userPool.userPoolId,
    });
    new ssm.StringParameter(this, 'UserPoolClientIdParameter', {
      parameterName: names.userPoolClientId,
      stringValue: this.userPoolClient.userPoolClientId,
    });

    this.addSmokeUser(props.stage.smokeUserEmail);

    // Accepted cdk-nag findings, documented in docs/architecture.md (section "cdk-nag").
    Validations.of(this.userPool).acknowledge({
      id: 'AwsSolutions-COG2',
      reason:
        'MFA is not required for this hobby app; email and password login with SRP is the agreed scope.',
    });
    Validations.of(this.userPool).acknowledge({
      id: 'AwsSolutions-COG8',
      reason:
        'Threat protection needs the Plus feature plan, which is billed per user; the app should cost close to nothing when idle.',
    });
  }

  /**
   * The user the smoke tests sign in with after each deploy. The deploy passes its password
   * as NoEcho parameter from the GitHub secret SMOKE_USER_PASSWORD; without it, nothing is
   * created. The user is confirmed right away and gets no invitation mail.
   */
  private addSmokeUser(email: string) {
    const password = new CfnParameter(this, 'SmokeUserPassword', {
      type: 'String',
      noEcho: true,
      default: '',
      description: 'Password of the smoke test user; empty means no smoke test user.',
    });
    const enabled = new CfnCondition(this, 'HasSmokeUser', {
      expression: Fn.conditionNot(Fn.conditionEquals(password.valueAsString, '')),
    });

    const user = new cognito.CfnUserPoolUser(this, 'SmokeUser', {
      userPoolId: this.userPool.userPoolId,
      username: email,
      messageAction: 'SUPPRESS',
      userAttributes: [
        { name: 'email', value: email },
        { name: 'email_verified', value: 'true' },
      ],
    });
    user.cfnOptions.condition = enabled;

    // CloudFormation cannot set a permanent password. A small own handler does it; the generic
    // AwsCustomResource is not used because its handler logs the whole event, password included.
    const logGroup = new logs.LogGroup(this, 'SmokeUserPasswordLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const setter = new lambda.Function(this, 'SmokeUserPasswordFunction', {
      description: 'Sets the permanent password of the smoke test user (never logs the event)',
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(SET_PASSWORD_HANDLER),
      timeout: Duration.seconds(30),
      logGroup,
    });
    setter.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:AdminSetUserPassword'],
        resources: [this.userPool.userPoolArn],
      }),
    );
    const passwordResource = new CustomResource(this, 'SmokeUserPasswordSetter', {
      serviceToken: setter.functionArn,
      resourceType: 'Custom::SmokeUserPassword',
      properties: {
        UserPoolId: this.userPool.userPoolId,
        Username: email,
        // A new secret value changes the properties and sets the new password on deploy.
        Password: password.valueAsString,
      },
    });
    passwordResource.node.addDependency(user);
    for (const construct of [logGroup, setter, passwordResource]) {
      for (const child of construct.node.findAll()) {
        if (child instanceof CfnResource) child.cfnOptions.condition = enabled;
      }
    }

    new CfnOutput(this, 'SmokeUserEmail', { value: email, condition: enabled });

    Validations.of(setter).acknowledge({
      id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
      reason:
        'The managed basic execution role only allows writing its own CloudWatch logs; the only other permission is AdminSetUserPassword on this user pool.',
    });
  }
}

import { RemovalPolicy, Stack, type StackProps, Validations } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';

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
}

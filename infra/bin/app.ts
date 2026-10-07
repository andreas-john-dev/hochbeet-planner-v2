import { App, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { stages } from '../lib/config/stages';
import { SharedStatefulStack } from '../lib/shared/SharedStatefulStack';

const app = new App();

for (const stage of stages) {
  const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: stage.region };

  new SharedStatefulStack(app, `${stage.stackPrefix}-SharedStateful`, { env, stage });
}

// cdk-nag runs as a policy validation plugin; violations fail `cdk synth`.
Validations.of(app).addPlugins(new AwsSolutionsChecks(app));

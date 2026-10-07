import { fileURLToPath } from 'node:url';
import { App, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { stages } from '../lib/config/stages';
import { FrontendStack } from '../lib/frontend/FrontendStack';
import { SharedStatefulStack } from '../lib/shared/SharedStatefulStack';

const app = new App();
const webDistPath = fileURLToPath(new URL('../../apps/web/dist', import.meta.url));

for (const stage of stages) {
  const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: stage.region };

  const shared = new SharedStatefulStack(app, `${stage.stackPrefix}-SharedStateful`, {
    env,
    stage,
  });
  const frontend = new FrontendStack(app, `${stage.stackPrefix}-Frontend`, {
    env,
    stage,
    webDistPath,
  });
  frontend.addStackDependency(shared, 'config.json reads the user pool ids from SSM');
}

// cdk-nag runs as a policy validation plugin; violations fail `cdk synth`.
Validations.of(app).addPlugins(new AwsSolutionsChecks(app));

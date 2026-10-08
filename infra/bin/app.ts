import { fileURLToPath } from 'node:url';
import { App, Validations } from 'aws-cdk-lib';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { AwsSolutionsChecks } from 'cdk-nag';
import { CatalogStatefulStack } from '../lib/catalog/CatalogStatefulStack';
import { CatalogStatelessStack } from '../lib/catalog/CatalogStatelessStack';
import { ssmParameters } from '../lib/config/ssm';
import { CLOUDFRONT_CERTIFICATE_REGION, stages } from '../lib/config/stages';
import { GardenStatefulStack } from '../lib/garden/GardenStatefulStack';
import { GardenStatelessStack } from '../lib/garden/GardenStatelessStack';
import { CertificateStack } from '../lib/frontend/CertificateStack';
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
  const catalogStateful = new CatalogStatefulStack(app, `${stage.stackPrefix}-CatalogStateful`, {
    env,
    stage,
  });
  const catalogStateless = new CatalogStatelessStack(app, `${stage.stackPrefix}-CatalogStateless`, {
    env,
    stage,
  });
  catalogStateless.addStackDependency(shared, 'JWT authorizer reads the user pool ids from SSM');
  catalogStateless.addStackDependency(catalogStateful, 'reads the table name from SSM');

  const gardenStateful = new GardenStatefulStack(app, `${stage.stackPrefix}-GardenStateful`, {
    env,
    stage,
  });
  const gardenStateless = new GardenStatelessStack(app, `${stage.stackPrefix}-GardenStateless`, {
    env,
    stage,
  });
  gardenStateless.addStackDependency(shared, 'JWT authorizer reads the user pool ids from SSM');
  gardenStateless.addStackDependency(gardenStateful, 'reads the table name from SSM');
  const certificate = new CertificateStack(app, `${stage.stackPrefix}-Certificate`, {
    env: { account: env.account, region: CLOUDFRONT_CERTIFICATE_REGION },
    stage,
  });
  const frontend = new FrontendStack(app, `${stage.stackPrefix}-Frontend`, {
    env,
    stage,
    webDistPath,
    certificate: certificate.certificate,
  });
  frontend.addStackDependency(shared, 'config.json reads the user pool ids from SSM');
  frontend.addStackDependency(catalogStateless, '/api/catalog/* reads the API domain from SSM');
  frontend.addStackDependency(gardenStateless, '/api/garden/* reads the API domain from SSM');
  const names = ssmParameters(stage);
  const apiOrigin = (parameterName: string) =>
    new HttpOrigin(ssm.StringParameter.valueForStringParameter(frontend, parameterName));
  frontend.addApiBehavior('/api/catalog/*', apiOrigin(names.catalogApiDomain));
  frontend.addApiBehavior('/api/garden/*', apiOrigin(names.gardenApiDomain));
}

// cdk-nag runs as a policy validation plugin; violations fail `cdk synth`.
Validations.of(app).addPlugins(new AwsSolutionsChecks(app));

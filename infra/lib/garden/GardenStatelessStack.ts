import { fileURLToPath } from 'node:url';
import { BASE_PATH } from '@hochbeet/garden-service';
import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';
import { ServiceApiStack } from '../shared/ServiceApiStack';

export interface GardenStatelessStackProps extends StackProps {
  readonly stage: StageConfig;
}

/** Garden Lambdalith behind its HTTP API. */
export class GardenStatelessStack extends ServiceApiStack {
  constructor(scope: Construct, id: string, props: GardenStatelessStackProps) {
    const names = ssmParameters(props.stage);
    super(scope, id, {
      ...props,
      title: 'Garden',
      entry: fileURLToPath(new URL('../../../services/garden/src/handler.ts', import.meta.url)),
      basePath: BASE_PATH,
      tableNameParameter: names.gardenTableName,
      apiDomainParameter: names.gardenApiDomain,
    });
  }
}

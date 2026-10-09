import { fileURLToPath } from 'node:url';
import { BASE_PATH, catalogTable, PUBLIC_PLANTS_PATH } from '@hochbeet/catalog-service';
import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';
import { ServiceApiStack } from '../shared/ServiceApiStack';

export interface CatalogStatelessStackProps extends StackProps {
  readonly stage: StageConfig;
}

/**
 * Catalog Lambdalith behind its HTTP API; may query the publication index. The global
 * catalogue is also public for guests.
 */
export class CatalogStatelessStack extends ServiceApiStack {
  constructor(scope: Construct, id: string, props: CatalogStatelessStackProps) {
    const names = ssmParameters(props.stage);
    super(scope, id, {
      ...props,
      title: 'Catalog',
      entry: fileURLToPath(new URL('../../../services/catalog/src/handler.ts', import.meta.url)),
      basePath: BASE_PATH,
      tableNameParameter: names.catalogTableName,
      apiDomainParameter: names.catalogApiDomain,
      indexNames: [catalogTable.publicationIndex.name],
      publicGetPaths: [PUBLIC_PLANTS_PATH],
    });
  }
}

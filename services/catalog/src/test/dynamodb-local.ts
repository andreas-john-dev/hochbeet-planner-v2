import { startDynamoDbTable } from '@hochbeet/service-kit/testing';
import { catalogTable } from '../table';

/** DynamoDB Local with the catalog table, created from `catalogTable`. */
export const startCatalogTable = (tableName = 'catalog') =>
  startDynamoDbTable(
    {
      partitionKey: catalogTable.partitionKey,
      sortKey: catalogTable.sortKey,
      indexes: [catalogTable.publicationIndex],
    },
    tableName,
  );

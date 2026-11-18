import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { migrateViews, VIEW_MIGRATION_VERSION } from './view';

const PHYSICAL_ID = 'garden-view-migration';

let documentClient: DynamoDBDocumentClient | undefined;

/** onEvent handler of the view migration custom resource (CDK Provider framework). */
export async function handler(event: CloudFormationCustomResourceEvent) {
  if (event.RequestType === 'Delete') {
    // The table is retained, and so are the migrated settings.
    return { PhysicalResourceId: PHYSICAL_ID };
  }
  const tableName = process.env.TABLE_NAME;
  if (!tableName) throw new Error('TABLE_NAME is not set');
  documentClient ??= DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const result = await migrateViews(documentClient, tableName);
  console.info(JSON.stringify({ message: 'garden views migrated', ...result }));
  return {
    PhysicalResourceId: PHYSICAL_ID,
    Data: {
      Expert: result.expert,
      Unchanged: result.unchanged,
      MigrationVersion: VIEW_MIGRATION_VERSION,
    },
  };
}

import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { seedItems, seedVersion, type GlobalPlantItem } from './items';

export interface SeedResult {
  written: number;
  unchanged: number;
}

/**
 * Writes the seed plants as global plants. Idempotent: the key is the fixed plant id, and a
 * plant is only written when it is missing or its seed content changed (`seedHash`). Plants
 * whose seed did not change keep their stored state, e.g. corrections made by admins.
 */
export async function writeSeed(
  client: DynamoDBDocumentClient,
  tableName: string,
  items: readonly GlobalPlantItem[],
): Promise<SeedResult> {
  const results = await Promise.all(
    items.map(async (item) => {
      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: item,
            ConditionExpression: 'attribute_not_exists(PK) OR seedHash <> :seedHash',
            ExpressionAttributeValues: { ':seedHash': item.seedHash },
          }),
        );
        return true;
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) return false;
        throw error;
      }
    }),
  );
  const written = results.filter(Boolean).length;
  return { written, unchanged: results.length - written };
}

const PHYSICAL_ID = 'catalog-seed';

let documentClient: DynamoDBDocumentClient | undefined;

/** onEvent handler of the seed custom resource (CDK Provider framework). */
export async function handler(event: CloudFormationCustomResourceEvent) {
  if (event.RequestType === 'Delete') {
    // The table is retained, and so is its data.
    return { PhysicalResourceId: PHYSICAL_ID };
  }
  const tableName = process.env.TABLE_NAME;
  if (!tableName) throw new Error('TABLE_NAME is not set');
  documentClient ??= DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const result = await writeSeed(documentClient, tableName, seedItems());
  console.info(JSON.stringify({ message: 'catalog seed written', ...result }));
  return {
    PhysicalResourceId: PHYSICAL_ID,
    Data: { Written: result.written, Unchanged: result.unchanged, SeedVersion: seedVersion() },
  };
}

import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { type DynamoDBDocumentClient, paginateScan, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DEFAULT_LAST_FROST, type GardenView } from '@hochbeet/contracts';
import { BED_PREFIX, SETTINGS_SK, SOWING_PREFIX } from '../table';

/**
 * Version of the view migration (T-73). The custom resource only runs again when it changes,
 * so it ran exactly once: later runs would also move new users with beds but no saved view.
 */
export const VIEW_MIGRATION_VERSION = 1;

const EXPERT: GardenView = 'EXPERT';
const WRITE_CONCURRENCY = 25;

/** Beds (with their plantings), sowing batches or settings; import records alone are none. */
const isData = (sk: string) =>
  sk.startsWith(BED_PREFIX) || sk.startsWith(SOWING_PREFIX) || sk === SETTINGS_SK;

/** Partition keys (`USER#<sub>`) of all users with data in the garden table. */
export async function usersWithData(
  client: DynamoDBDocumentClient,
  tableName: string,
): Promise<string[]> {
  const users = new Set<string>();
  const pages = paginateScan({ client }, { TableName: tableName, ProjectionExpression: 'PK, SK' });
  for await (const page of pages) {
    for (const item of page.Items ?? []) {
      const { PK, SK } = item as { PK?: unknown; SK?: unknown };
      if (typeof PK === 'string' && typeof SK === 'string' && isData(SK)) users.add(PK);
    }
  }
  return [...users];
}

export interface ViewMigrationResult {
  expert: number;
  unchanged: number;
}

/**
 * Users who already had data before the simple view existed keep the view they know: their
 * settings get `view: 'EXPERT'`, with the default last frost if they never saved one. A view
 * that is already set is never overwritten, so the migration is idempotent; users without
 * data stay without settings and start simple.
 */
export async function migrateViews(
  client: DynamoDBDocumentClient,
  tableName: string,
): Promise<ViewMigrationResult> {
  const users = await usersWithData(client, tableName);
  let expert = 0;
  for (let i = 0; i < users.length; i += WRITE_CONCURRENCY) {
    const written = await Promise.all(
      users.slice(i, i + WRITE_CONCURRENCY).map(async (pk) => {
        try {
          await client.send(
            new UpdateCommand({
              TableName: tableName,
              Key: { PK: pk, SK: SETTINGS_SK },
              UpdateExpression:
                'SET #view = :view, lastFrost = if_not_exists(lastFrost, :lastFrost)',
              ConditionExpression: 'attribute_not_exists(#view)',
              ExpressionAttributeNames: { '#view': 'view' },
              ExpressionAttributeValues: { ':view': EXPERT, ':lastFrost': DEFAULT_LAST_FROST },
            }),
          );
          return true;
        } catch (error) {
          if (error instanceof ConditionalCheckFailedException) return false;
          throw error;
        }
      }),
    );
    expert += written.filter(Boolean).length;
  }
  return { expert, unchanged: users.length - expert };
}

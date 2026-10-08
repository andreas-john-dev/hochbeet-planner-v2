import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { type Plant, type PlantOverride, PlantSchema } from '@hochbeet/contracts';
import {
  catalogTable,
  GLOBAL_PK,
  OVERRIDE_PREFIX,
  overrideSk,
  PLANT_PREFIX,
  plantSk,
  PUBLICATION_PENDING,
  USER_PREFIX,
  userPk,
} from '../table';
import {
  type OverrideItem,
  OverrideItemSchema,
  type OwnPlantItem,
  OwnPlantItemSchema,
} from './effective';

/** Global plants change rarely (seed, admin); each Lambda instance caches them briefly. */
export const GLOBAL_CACHE_MS = 5 * 60 * 1000;

/** An own plant waiting in the admin queue, with the user who asked. */
export interface PendingPublication {
  userId: string;
  plant: OwnPlantItem;
}

export interface UserCatalogItems {
  overrides: OverrideItem[];
  own: OwnPlantItem[];
}

export class CatalogRepository {
  private globalCache: { plants: Plant[]; loadedAt: number } | undefined;

  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly now: () => number = Date.now,
  ) {}

  async listGlobalPlants(): Promise<Plant[]> {
    const cached = this.globalCache;
    if (cached && this.now() - cached.loadedAt < GLOBAL_CACHE_MS) return cached.plants;
    const items = await this.queryPartition(GLOBAL_PK);
    const plants = items
      .filter((item) => String(item.SK).startsWith(PLANT_PREFIX))
      .map((item) => PlantSchema.parse(item));
    this.globalCache = { plants, loadedAt: this.now() };
    return plants;
  }

  async listUserItems(userId: string): Promise<UserCatalogItems> {
    const items = await this.queryPartition(userPk(userId));
    const sk = (item: Record<string, unknown>) => String(item.SK);
    return {
      overrides: items
        .filter((item) => sk(item).startsWith(OVERRIDE_PREFIX))
        .map((item) => OverrideItemSchema.parse(item)),
      own: items
        .filter((item) => sk(item).startsWith(PLANT_PREFIX))
        .map((item) => OwnPlantItemSchema.parse(item)),
    };
  }

  async getGlobalPlant(plantId: string): Promise<Plant | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { PK: GLOBAL_PK, SK: plantSk(plantId) } }),
    );
    return Item ? PlantSchema.parse(Item) : undefined;
  }

  /** An own plant of the user, archived ones included. */
  async getOwnPlant(userId: string, plantId: string): Promise<OwnPlantItem | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: this.ownKey(userId, plantId) }),
    );
    return Item ? OwnPlantItemSchema.parse(Item) : undefined;
  }

  async createOwnPlant(userId: string, item: OwnPlantItem): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: this.ownRecord(userId, item),
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  /** Replaces an own plant that exists and is not archived; false otherwise. */
  async replaceOwnPlant(userId: string, item: OwnPlantItem): Promise<boolean> {
    return this.ifConditionHolds(() =>
      this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.ownRecord(userId, item),
          ConditionExpression: 'attribute_exists(PK) AND archived <> :true',
          ExpressionAttributeValues: { ':true': true },
        }),
      ),
    );
  }

  /** Marks an own plant as archived and takes it out of the admin queue. It stays stored. */
  async archiveOwnPlant(userId: string, plantId: string, archivedAt: string): Promise<boolean> {
    return this.ifConditionHolds(() =>
      this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: this.ownKey(userId, plantId),
          UpdateExpression: 'SET archived = :true, archivedAt = :at REMOVE GSI1PK, GSI1SK',
          ConditionExpression: 'attribute_exists(PK) AND archived <> :true',
          ExpressionAttributeValues: { ':true': true, ':at': archivedAt },
        }),
      ),
    );
  }

  async putOverride(userId: string, plantId: string, fields: PlantOverride): Promise<void> {
    const item: OverrideItem = { plantId, fields };
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: userPk(userId), SK: overrideSk(plantId), ...item },
      }),
    );
  }

  async deleteOverride(userId: string, plantId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: overrideSk(plantId) },
      }),
    );
  }

  /** Global plant by id, for admins; keeps `seedHash` so later seed changes still apply. */
  async putGlobalPlant(plant: Plant, mode: 'create' | 'replace'): Promise<boolean> {
    const key = { PK: GLOBAL_PK, SK: plantSk(plant.id) };
    let seedHash: unknown;
    if (mode === 'replace') {
      const { Item } = await this.client.send(
        new GetCommand({ TableName: this.tableName, Key: key }),
      );
      if (!Item) return false;
      seedHash = Item.seedHash;
    }
    const written = await this.ifConditionHolds(() =>
      this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...key, ...plant, ...(seedHash === undefined ? {} : { seedHash }) },
          ConditionExpression:
            mode === 'create' ? 'attribute_not_exists(PK)' : 'attribute_exists(PK)',
        }),
      ),
    );
    this.globalCache = undefined;
    return written;
  }

  /** The admin queue, oldest request first. */
  async listPendingPublications(): Promise<PendingPublication[]> {
    const index = catalogTable.publicationIndex;
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: index.name,
          KeyConditionExpression: `${index.partitionKey} = :pk`,
          ExpressionAttributeValues: { ':pk': PUBLICATION_PENDING },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...(page.Items ?? []));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return items.map((item) => ({
      userId: String(item.PK).slice(USER_PREFIX.length),
      plant: OwnPlantItemSchema.parse(item),
    }));
  }

  /**
   * Publishes a pending own plant atomically: the global plant (same id) is created and the
   * own plant leaves the queue as PUBLISHED. False if it is no longer pending.
   */
  async approvePublication(userId: string, plant: Plant): Promise<boolean> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { PK: GLOBAL_PK, SK: plantSk(plant.id), ...plant },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: this.ownKey(userId, plant.id),
                UpdateExpression:
                  'SET publicationStatus = :published REMOVE GSI1PK, GSI1SK, requestedAt, rejectionComment',
                ConditionExpression: 'publicationStatus = :pending',
                ExpressionAttributeValues: { ':published': 'PUBLISHED', ':pending': 'PENDING' },
              },
            },
          ],
        }),
      );
    } catch (error) {
      if (error instanceof TransactionCanceledException) return false;
      throw error;
    }
    this.globalCache = undefined;
    return true;
  }

  /** Sends a pending own plant back to PRIVATE with the admin's comment. */
  async rejectPublication(userId: string, plantId: string, comment: string): Promise<boolean> {
    return this.ifConditionHolds(() =>
      this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: this.ownKey(userId, plantId),
          UpdateExpression:
            'SET publicationStatus = :private, rejectionComment = :comment REMOVE GSI1PK, GSI1SK, requestedAt',
          ConditionExpression: 'publicationStatus = :pending',
          ExpressionAttributeValues: {
            ':private': 'PRIVATE',
            ':comment': comment,
            ':pending': 'PENDING',
          },
        }),
      ),
    );
  }

  /** Stored form of an own plant; pending plants carry the GSI1 keys of the admin queue. */
  private ownRecord(userId: string, item: OwnPlantItem) {
    const queue =
      item.publicationStatus === 'PENDING' && item.requestedAt
        ? { GSI1PK: PUBLICATION_PENDING, GSI1SK: `${item.requestedAt}#${item.id}` }
        : {};
    return { ...this.ownKey(userId, item.id), ...item, ...queue };
  }

  private ownKey(userId: string, plantId: string) {
    return { PK: userPk(userId), SK: plantSk(plantId) };
  }

  private async ifConditionHolds(write: () => Promise<unknown>): Promise<boolean> {
    try {
      await write();
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }

  /** All items of one partition, following pagination. */
  private async queryPartition(pk: string): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': pk },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...(page.Items ?? []));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return items;
  }
}

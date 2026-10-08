import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { type Plant, type PlantOverride, PlantSchema } from '@hochbeet/contracts';
import { GLOBAL_PK, OVERRIDE_PREFIX, overrideSk, PLANT_PREFIX, plantSk, userPk } from '../table';
import {
  type OverrideItem,
  OverrideItemSchema,
  type OwnPlantItem,
  OwnPlantItemSchema,
} from './effective';

/** Global plants change rarely (seed, admin); each Lambda instance caches them briefly. */
export const GLOBAL_CACHE_MS = 5 * 60 * 1000;

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
        Item: { ...this.ownKey(userId, item.id), ...item },
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
          Item: { ...this.ownKey(userId, item.id), ...item },
          ConditionExpression: 'attribute_exists(PK) AND archived <> :true',
          ExpressionAttributeValues: { ':true': true },
        }),
      ),
    );
  }

  /** Marks an own plant as archived. It stays stored because plantings may reference it. */
  async archiveOwnPlant(userId: string, plantId: string, archivedAt: string): Promise<boolean> {
    return this.ifConditionHolds(() =>
      this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: this.ownKey(userId, plantId),
          UpdateExpression: 'SET archived = :true, archivedAt = :at',
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

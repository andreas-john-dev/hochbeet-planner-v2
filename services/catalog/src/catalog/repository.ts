import { type DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { type Plant, PlantSchema } from '@hochbeet/contracts';
import { GLOBAL_PK, OVERRIDE_PREFIX, PLANT_PREFIX, userPk } from '../table';
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

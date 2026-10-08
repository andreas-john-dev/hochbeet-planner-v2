import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { type Bed, BedSchema, type Planting, PlantingSchema } from '@hochbeet/contracts';
import { BED_PREFIX, bedSk, PLANTING_INFIX, plantingSk, userPk } from '../table';

type Item = Record<string, unknown>;

/** Deletes running in parallel; plain DeleteItem keeps the IAM policy to item actions. */
const DELETE_CONCURRENCY = 25;

export interface BedWithPlantings {
  bed: Bed;
  plantings: Planting[];
}

export class GardenRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async listBeds(userId: string): Promise<Bed[]> {
    const items = await this.query(userId, BED_PREFIX);
    return items
      .filter((item) => !String(item.SK).includes(PLANTING_INFIX))
      .map((item) => BedSchema.parse(item));
  }

  /** One query loads the bed and all its plantings over all time. */
  async getBedWithPlantings(userId: string, bedId: string): Promise<BedWithPlantings | undefined> {
    const items = await this.query(userId, bedSk(bedId));
    const bedItem = items.find((item) => item.SK === bedSk(bedId));
    if (!bedItem) return undefined;
    return {
      bed: BedSchema.parse(bedItem),
      plantings: items
        .filter((item) => item.SK !== bedSk(bedId))
        .map((item) => PlantingSchema.parse(item)),
    };
  }

  async createBed(userId: string, bed: Bed): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: userPk(userId), SK: bedSk(bed.id), ...bed },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  /** Replaces an existing bed; false if it does not exist (for this user). */
  async replaceBed(userId: string, bed: Bed): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { PK: userPk(userId), SK: bedSk(bed.id), ...bed },
          ConditionExpression: 'attribute_exists(PK)',
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }

  /** Writes a planting of a bed; used by the planting endpoints and tests. */
  async putPlanting(userId: string, planting: Planting): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: userPk(userId), SK: plantingSk(planting.bedId, planting.id), ...planting },
      }),
    );
  }

  /**
   * Deletes the bed with all its plantings; false if there is no such bed. Plantings go
   * first and the bed last, so an interrupted delete can simply be repeated.
   */
  async deleteBed(userId: string, bedId: string): Promise<boolean> {
    const items = await this.query(userId, bedSk(bedId));
    if (!items.some((item) => item.SK === bedSk(bedId))) return false;
    const plantingKeys = items
      .filter((item) => item.SK !== bedSk(bedId))
      .map((item) => ({ PK: userPk(userId), SK: String(item.SK) }));
    for (let i = 0; i < plantingKeys.length; i += DELETE_CONCURRENCY) {
      await Promise.all(
        plantingKeys.slice(i, i + DELETE_CONCURRENCY).map((key) => this.delete(key)),
      );
    }
    await this.delete({ PK: userPk(userId), SK: bedSk(bedId) });
    return true;
  }

  private async delete(key: Item) {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: key }));
  }

  /** All items of the user whose sort key starts with `prefix`, following pagination. */
  private async query(userId: string, prefix: string): Promise<Item[]> {
    const items: Item[] = [];
    let startKey: Item | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': userPk(userId), ':prefix': prefix },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...(page.Items ?? []));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return items;
  }
}

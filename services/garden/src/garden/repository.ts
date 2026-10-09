import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { type Bed, BedSchema, type Planting, PlantingSchema } from '@hochbeet/contracts';
import { z } from 'zod';
import { BED_PREFIX, bedSk, importSk, PLANTING_INFIX, plantingSk, userPk } from '../table';

type Item = Record<string, unknown>;

/** Writes running in parallel; plain item actions keep the IAM policy small. */
const DELETE_CONCURRENCY = 25;
const WRITE_CONCURRENCY = 25;

/** State of a guest import: new id per imported id, and the response once it is done. */
export const ImportRecordSchema = z.object({
  ids: z.record(z.string(), z.string()),
  result: z.unknown().optional(),
});
export type ImportRecord = z.infer<typeof ImportRecordSchema>;

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
    return this.ifConditionHolds(() =>
      this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { PK: userPk(userId), SK: bedSk(bed.id), ...bed },
          ConditionExpression: 'attribute_exists(PK)',
        }),
      ),
    );
  }

  async bedExists(userId: string, bedId: string): Promise<boolean> {
    const { Item } = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: bedSk(bedId) },
        ProjectionExpression: 'PK',
      }),
    );
    return Item !== undefined;
  }

  /**
   * Writes a planting of a bed. `create` refuses to overwrite, `replace` needs an existing
   * planting; false if that condition fails.
   */
  async putPlanting(
    userId: string,
    planting: Planting,
    mode: 'create' | 'replace' = 'create',
  ): Promise<boolean> {
    return this.ifConditionHolds(() =>
      this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { PK: userPk(userId), SK: plantingSk(planting.bedId, planting.id), ...planting },
          ConditionExpression:
            mode === 'create' ? 'attribute_not_exists(PK)' : 'attribute_exists(PK)',
        }),
      ),
    );
  }

  /** Deletes one planting; false if it does not exist. */
  async deletePlanting(userId: string, bedId: string, plantingId: string): Promise<boolean> {
    return this.ifConditionHolds(() =>
      this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { PK: userPk(userId), SK: plantingSk(bedId, plantingId) },
          ConditionExpression: 'attribute_exists(PK)',
        }),
      ),
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

  async getImport(userId: string, importId: string): Promise<ImportRecord | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: importSk(importId) },
      }),
    );
    return Item ? ImportRecordSchema.parse(Item) : undefined;
  }

  async putImport(userId: string, importId: string, record: ImportRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: userPk(userId), SK: importSk(importId), ...record },
      }),
    );
  }

  /**
   * Writes imported beds and their plantings without conditions: the ids are new and fixed
   * by the import record, so writing them again after an interruption changes nothing.
   */
  async putImported(userId: string, beds: readonly Bed[], plantings: readonly Planting[]) {
    const items = [
      ...beds.map((bed) => ({ PK: userPk(userId), SK: bedSk(bed.id), ...bed })),
      ...plantings.map((p) => ({ PK: userPk(userId), SK: plantingSk(p.bedId, p.id), ...p })),
    ];
    for (let i = 0; i < items.length; i += WRITE_CONCURRENCY) {
      await Promise.all(
        items
          .slice(i, i + WRITE_CONCURRENCY)
          .map((Item) => this.client.send(new PutCommand({ TableName: this.tableName, Item }))),
      );
    }
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

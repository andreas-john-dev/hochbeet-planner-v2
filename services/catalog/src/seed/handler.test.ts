import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, type PutCommandInput } from '@aws-sdk/lib-dynamodb';
import { seedPlants } from '@hochbeet/catalog-seed';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler, writeSeed } from './handler';
import { seedItems, type GlobalPlantItem } from './items';

const ddb = mockClient(DynamoDBDocumentClient);

/** In-memory table that honours the seed's condition expression. */
function fakeTable() {
  const rows = new Map<string, GlobalPlantItem>();
  ddb.on(PutCommand).callsFake((input: PutCommandInput) => {
    const item = input.Item as GlobalPlantItem;
    const key = `${item.PK}|${item.SK}`;
    const existing = rows.get(key);
    const newHash = input.ExpressionAttributeValues?.[':seedHash'] as string;
    if (existing?.seedHash === newHash) {
      throw new ConditionalCheckFailedException({ message: 'condition failed', $metadata: {} });
    }
    rows.set(key, item);
    return {};
  });
  return rows;
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

beforeEach(() => {
  ddb.reset();
});

describe('writeSeed', () => {
  it('writes all 56 seed plants as global plants', async () => {
    const rows = fakeTable();
    const result = await writeSeed(client, 'catalog', seedItems());
    expect(result).toEqual({ written: 56, unchanged: 0 });
    expect(rows.size).toBe(56);
    const tomato = [...rows.values()].find((row) => row.name === 'Tomate');
    expect(tomato).toMatchObject({ PK: 'GLOBAL', SK: `PLANT#${tomato?.id ?? ''}` });
  });

  it('creates no duplicates when it runs twice', async () => {
    const rows = fakeTable();
    await writeSeed(client, 'catalog', seedItems());
    const second = await writeSeed(client, 'catalog', seedItems());
    expect(second).toEqual({ written: 0, unchanged: 56 });
    expect(rows.size).toBe(56);
  });

  it('only rewrites plants whose seed changed and keeps other stored changes', async () => {
    const rows = fakeTable();
    await writeSeed(client, 'catalog', seedItems());
    // An admin corrected the basil spacing; the seed for basil is unchanged.
    const basilKey = [...rows.keys()].find((key) => rows.get(key)?.name === 'Basilikum') ?? '';
    const basil = rows.get(basilKey);
    if (!basil) throw new Error('basil missing');
    rows.set(basilKey, { ...basil, spacingInRowCm: 20 });

    const changed = seedPlants.map((plant) =>
      plant.name === 'Tomate' ? { ...plant, spacingInRowCm: 50 } : plant,
    );
    const result = await writeSeed(client, 'catalog', seedItems(changed));

    expect(result).toEqual({ written: 1, unchanged: 55 });
    expect([...rows.values()].find((row) => row.name === 'Tomate')?.spacingInRowCm).toBe(50);
    expect(rows.get(basilKey)?.spacingInRowCm).toBe(20);
    expect(rows.size).toBe(56);
  });

  it('uses a condition so unchanged plants are never overwritten', async () => {
    fakeTable();
    await writeSeed(client, 'catalog', seedItems().slice(0, 1));
    expect(ddb.commandCalls(PutCommand)[0]?.args[0].input).toMatchObject({
      TableName: 'catalog',
      ConditionExpression: 'attribute_not_exists(PK) OR seedHash <> :seedHash',
    });
  });

  it('rethrows other errors', async () => {
    ddb.on(PutCommand).rejects(new Error('throttled'));
    await expect(writeSeed(client, 'catalog', seedItems())).rejects.toThrow('throttled');
  });
});

describe('handler', () => {
  const event = (RequestType: 'Create' | 'Update' | 'Delete') =>
    ({ RequestType, ResourceProperties: {} }) as unknown as CloudFormationCustomResourceEvent;

  beforeEach(() => {
    vi.stubEnv('TABLE_NAME', 'catalog');
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(['Create', 'Update'] as const)('seeds on %s', async (type) => {
    fakeTable();
    const response = await handler(event(type));
    expect(response).toMatchObject({
      PhysicalResourceId: 'catalog-seed',
      Data: { Written: 56, Unchanged: 0 },
    });
  });

  it('keeps the data on delete', async () => {
    const response = await handler(event('Delete'));
    expect(response).toEqual({ PhysicalResourceId: 'catalog-seed' });
    expect(ddb.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('fails without table name', async () => {
    vi.stubEnv('TABLE_NAME', '');
    await expect(handler(event('Create'))).rejects.toThrow('TABLE_NAME');
  });
});

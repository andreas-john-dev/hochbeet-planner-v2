import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedItems } from '../seed/items';
import { CatalogRepository, GLOBAL_CACHE_MS } from './repository';

const ddb = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

beforeEach(() => {
  ddb.reset();
});

describe('CatalogRepository', () => {
  it('follows pagination', async () => {
    const items = seedItems();
    ddb
      .on(QueryCommand)
      .resolvesOnce({ Items: items.slice(0, 30), LastEvaluatedKey: { PK: 'GLOBAL', SK: 'x' } })
      .resolvesOnce({ Items: items.slice(30) });
    const plants = await new CatalogRepository(client, 'catalog').listGlobalPlants();
    expect(plants).toHaveLength(56);
    expect(ddb.commandCalls(QueryCommand)[1]?.args[0].input.ExclusiveStartKey).toEqual({
      PK: 'GLOBAL',
      SK: 'x',
    });
  });

  it('caches global plants for a few minutes', async () => {
    ddb.on(QueryCommand).resolves({ Items: seedItems() });
    let now = 0;
    const repository = new CatalogRepository(client, 'catalog', () => now);
    await repository.listGlobalPlants();
    now = GLOBAL_CACHE_MS - 1;
    await repository.listGlobalPlants();
    expect(ddb.commandCalls(QueryCommand)).toHaveLength(1);
    now = GLOBAL_CACHE_MS;
    await repository.listGlobalPlants();
    expect(ddb.commandCalls(QueryCommand)).toHaveLength(2);
  });
});

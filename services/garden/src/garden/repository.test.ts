import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { GardenRepository } from './repository';

const ddb = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BED = '01J9ZQ3W8D6V2K5M7N8P9R0S1T';

beforeEach(() => {
  ddb.reset();
});

describe('GardenRepository', () => {
  it('loads a bed with all its plantings in one query', async () => {
    ddb.on(QueryCommand).resolves({
      Items: [
        {
          PK: 'USER#u',
          SK: `BED#${BED}`,
          id: BED,
          name: 'Beet',
          widthCm: 100,
          depthCm: 100,
          mainRowDirection: 'H',
          soilRenewals: [],
        },
        {
          PK: 'USER#u',
          SK: `BED#${BED}#PLANTING#01J9ZQ3W8D6V2K5M7N8P9R0S2A`,
          id: '01J9ZQ3W8D6V2K5M7N8P9R0S2A',
          bedId: BED,
          plantId: '01M49THV00SZ6Q8R32BYJM5P2S',
          kind: 'SINGLE',
          x: 0,
          y: 0,
          startDate: '2026-05-04',
          endDate: null,
          removedDate: null,
        },
      ],
    });
    const result = await new GardenRepository(client, 'garden').getBedWithPlantings('u', BED);
    expect(result?.plantings).toHaveLength(1);
    expect(result?.bed).not.toHaveProperty('PK');
    expect(ddb.commandCalls(QueryCommand)).toHaveLength(1);
    expect(ddb.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': 'USER#u', ':prefix': `BED#${BED}` },
    });
  });
});

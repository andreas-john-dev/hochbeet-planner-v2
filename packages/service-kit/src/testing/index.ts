import {
  type AttributeDefinition,
  CreateTableCommand,
  type CreateTableCommandInput,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import type { ApiEvent } from '../user';

const PORT = 8000;

export interface TableDefinition {
  partitionKey: string;
  sortKey: string;
  indexes?: readonly { name: string; partitionKey: string; sortKey: string }[];
}

/**
 * DynamoDB Local in Docker (Testcontainers) with one table created from the service's key
 * design. Integration tests call this in `beforeAll` and `stop()` in `afterAll`.
 */
export async function startDynamoDbTable(definition: TableDefinition, tableName = 'table') {
  const container: StartedTestContainer = await new GenericContainer('amazon/dynamodb-local:3.1.0')
    .withCommand(['-jar', 'DynamoDBLocal.jar', '-inMemory', '-sharedDb'])
    .withExposedPorts(PORT)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();
  const raw = new DynamoDBClient({
    endpoint: `http://${container.getHost()}:${String(container.getMappedPort(PORT))}`,
    region: 'eu-central-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  const indexes = definition.indexes ?? [];
  const names = [
    definition.partitionKey,
    definition.sortKey,
    ...indexes.flatMap((i) => [i.partitionKey, i.sortKey]),
  ];
  const keySchema = (pk: string, sk: string) => [
    { AttributeName: pk, KeyType: 'HASH' as const },
    { AttributeName: sk, KeyType: 'RANGE' as const },
  ];
  const input: CreateTableCommandInput = {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [...new Set(names)].map((name): AttributeDefinition => ({
      AttributeName: name,
      AttributeType: 'S',
    })),
    KeySchema: keySchema(definition.partitionKey, definition.sortKey),
    ...(indexes.length > 0
      ? {
          GlobalSecondaryIndexes: indexes.map((i) => ({
            IndexName: i.name,
            KeySchema: keySchema(i.partitionKey, i.sortKey),
            Projection: { ProjectionType: 'ALL' as const },
          })),
        }
      : {}),
  };
  await raw.send(new CreateTableCommand(input));
  const client = DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return {
    client,
    tableName,
    stop: async () => {
      client.destroy();
      await container.stop();
    },
  };
}

/** Lambda bindings as the HTTP API JWT authorizer passes them. */
export const authorized = (sub: string, groups?: string) => ({
  event: {
    requestContext: {
      requestId: 'req-1',
      authorizer: { jwt: { claims: { sub, ...(groups ? { 'cognito:groups': groups } : {}) } } },
    },
  } satisfies ApiEvent,
});

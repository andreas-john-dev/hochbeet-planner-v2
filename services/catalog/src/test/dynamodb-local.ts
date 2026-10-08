import { CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { catalogTable } from '../table';

const PORT = 8000;

/** DynamoDB Local in Docker (Testcontainers) with the catalog table created from `catalogTable`. */
export async function startCatalogTable(tableName = 'catalog') {
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
  const { partitionKey, sortKey, publicationIndex: gsi } = catalogTable;
  const S = 'S' as const;
  await raw.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [partitionKey, sortKey, gsi.partitionKey, gsi.sortKey].map((name) => ({
        AttributeName: name,
        AttributeType: S,
      })),
      KeySchema: [
        { AttributeName: partitionKey, KeyType: 'HASH' },
        { AttributeName: sortKey, KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: gsi.name,
          KeySchema: [
            { AttributeName: gsi.partitionKey, KeyType: 'HASH' },
            { AttributeName: gsi.sortKey, KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    }),
  );
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

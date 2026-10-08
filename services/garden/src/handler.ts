import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { handle } from '@hono/aws-lambda';
import { createLogger } from '@hochbeet/service-kit';
import { createApp } from './app';
import { GardenRepository } from './garden/repository';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is not set');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

/** Lambda entry of the garden Lambdalith behind the HTTP API. */
export const handler = handle(
  createApp({
    store: new GardenRepository(client, tableName),
    logger: createLogger({ service: 'garden' }),
  }),
);

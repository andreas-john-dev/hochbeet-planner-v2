import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { handle } from '@hono/aws-lambda';
import { createApp } from './app';
import { CatalogRepository } from './catalog/repository';
import { createLogger } from './logger';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is not set');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

/** Lambda entry of the catalog Lambdalith behind the HTTP API. */
export const handler = handle(
  createApp({
    repository: new CatalogRepository(client, tableName),
    logger: createLogger({ service: 'catalog' }),
  }),
);

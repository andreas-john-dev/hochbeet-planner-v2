import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from './handler';

const ddb = mockClient(DynamoDBDocumentClient);

const event = (RequestType: 'Create' | 'Update' | 'Delete') =>
  ({ RequestType }) as CloudFormationCustomResourceEvent;

beforeEach(() => {
  ddb.reset();
  vi.stubEnv('TABLE_NAME', 'garden');
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('view migration handler', () => {
  it('migrates on create with a fixed physical id', async () => {
    ddb.on(ScanCommand).resolves({ Items: [{ PK: 'USER#a', SK: 'BED#1' }] });
    ddb.on(UpdateCommand).resolves({});
    const result = await handler(event('Create'));
    expect(result).toEqual({
      PhysicalResourceId: 'garden-view-migration',
      Data: { Expert: 1, Unchanged: 0, MigrationVersion: 1 },
    });
    expect(ddb.commandCalls(UpdateCommand)[0]?.args[0].input).toMatchObject({
      TableName: 'garden',
      Key: { PK: 'USER#a', SK: 'SETTINGS' },
      ConditionExpression: 'attribute_not_exists(#view)',
    });
  });

  it('writes nothing on delete', async () => {
    expect(await handler(event('Delete'))).toEqual({ PhysicalResourceId: 'garden-view-migration' });
    expect(ddb.calls()).toHaveLength(0);
  });

  it('fails without a table name', async () => {
    vi.stubEnv('TABLE_NAME', '');
    await expect(handler(event('Update'))).rejects.toThrow('TABLE_NAME is not set');
  });
});

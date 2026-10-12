import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGENT_SCHEMA_DIR, agentSchemas, schemaFile } from './json-schemas';

const root = join(import.meta.dirname, '../../..');

describe('JSON schemas for the agent', () => {
  it.each(Object.entries(agentSchemas))('%s is up to date', (file, schema) => {
    const written = readFileSync(join(root, AGENT_SCHEMA_DIR, file), 'utf8');
    expect(written, 'Run `pnpm --filter @hochbeet/contracts schemas`.').toBe(schemaFile(schema));
  });
});

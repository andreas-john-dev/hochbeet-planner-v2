import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_SCHEMA_DIR, agentSchemas, schemaFile } from '../src/json-schemas';

const root = join(import.meta.dirname, '../../..');
const dir = join(root, AGENT_SCHEMA_DIR);
mkdirSync(dir, { recursive: true });
for (const [file, schema] of Object.entries(agentSchemas)) {
  writeFileSync(join(dir, file), schemaFile(schema));
  console.log(`wrote ${join(AGENT_SCHEMA_DIR, file)}`);
}

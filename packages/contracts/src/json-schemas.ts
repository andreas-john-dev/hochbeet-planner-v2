import { z } from 'zod';
import { SuggestionListSchema } from './api/assistant';

/**
 * Contracts the Python agent reads as JSON Schema, by file name. The files live in the agent
 * package and are written by `pnpm --filter @hochbeet/contracts schemas`; a test fails when
 * they are out of date.
 */
export const AGENT_SCHEMA_DIR = 'agents/bed-assistant/src/bed_assistant/schemas';

export const agentSchemas = {
  'suggestion_list.json': SuggestionListSchema,
} as const;

/** The file content for a schema: stable, pretty JSON with a trailing newline. */
export const schemaFile = (schema: z.ZodType) =>
  `${JSON.stringify(z.toJSONSchema(schema, { io: 'input' }), null, 2)}\n`;

import { z } from 'zod';
import { BedWithPlantingsResponseSchema } from './garden';

// Beet-Assistent on Bedrock AgentCore (docs/architecture.md, "Beet-Assistent"). The agent is
// Python (agents/bed-assistant); its pydantic model mirrors this schema, and infra passes the
// limit below to it, so both sides check the same length.

/** Longest question the assistant accepts. */
export const MAX_ASSISTANT_MESSAGE_CHARS = 2000;

/** Body of a request to the runtime: the question, optionally with the bed it is about. */
export const AssistantRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Bitte schreib eine Frage an den Assistenten.')
    .max(
      MAX_ASSISTANT_MESSAGE_CHARS,
      `Deine Frage ist zu lang. Bitte fasse dich kürzer (höchstens ${String(MAX_ASSISTANT_MESSAGE_CHARS)} Zeichen).`,
    ),
  bed: BedWithPlantingsResponseSchema.optional(),
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

/**
 * One server-sent event of the answer stream (`data: <json>`): text chunks, then `done` with
 * the questions left today, or `error` with a German message if the model failed midway.
 */
export const AssistantEventSchema = z.union([
  z.object({ text: z.string() }),
  z.object({ done: z.literal(true), remaining: z.number().int().min(0) }),
  z.object({ error: z.string() }),
]);
export type AssistantEvent = z.infer<typeof AssistantEventSchema>;

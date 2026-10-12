import { z } from 'zod';
import { CategorySchema, FeederSchema, LifecycleSchema } from '../domain';
import { DirectionSchema, IsoDateSchema, UlidSchema } from '../primitives';

// Beet-Assistent on Bedrock AgentCore (docs/architecture.md, "Beet-Assistent"). The agent is
// Python (agents/bed-assistant); its pydantic model mirrors this schema, and infra passes the
// limit below to it, so both sides check the same length.

/** Longest question the assistant accepts. */
export const MAX_ASSISTANT_MESSAGE_CHARS = 2000;

/**
 * Body of a request to the runtime: the question, optionally with the bed the user is looking
 * at. The agent reads the bed itself through the gateway tools (below).
 */
export const AssistantRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Bitte schreib eine Frage an den Assistenten.')
    .max(
      MAX_ASSISTANT_MESSAGE_CHARS,
      `Deine Frage ist zu lang. Bitte fasse dich kürzer (höchstens ${String(MAX_ASSISTANT_MESSAGE_CHARS)} Zeichen).`,
    ),
  bedId: UlidSchema.optional(),
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

// ---------------------------------------------------------------------------
// Gateway tools (services/assistant-tools): read-only, always with the caller's token
// ---------------------------------------------------------------------------

/** list_beds: no input. */
export const ListBedsToolInputSchema = z.object({});

/** get_bed and evaluate_bed name one bed of the caller. */
export const GetBedToolInputSchema = z.object({
  bedId: UlidSchema.describe('ID des Beets, z. B. aus list_beds.'),
});

export const EvaluateBedToolInputSchema = GetBedToolInputSchema.extend({
  week: IsoDateSchema.optional().describe(
    'Ein Tag (JJJJ-MM-TT) der Woche, für die die Hinweise gelten sollen. Ohne Angabe: alle Hinweise der Beet-Historie.',
  ),
});

export const FindPlantsToolInputSchema = z.object({
  query: z
    .string()
    .trim()
    .max(50)
    .optional()
    .describe('Teil des Sortennamens, z. B. "Tomate". Ohne Angabe: alle Sorten.'),
});

export type ListBedsToolInput = z.infer<typeof ListBedsToolInputSchema>;
export type GetBedToolInput = z.infer<typeof GetBedToolInputSchema>;
export type EvaluateBedToolInput = z.infer<typeof EvaluateBedToolInputSchema>;
export type FindPlantsToolInput = z.infer<typeof FindPlantsToolInputSchema>;

const ToolBedSchema = z.object({
  id: UlidSchema,
  name: z.string(),
  widthCm: z.number(),
  depthCm: z.number(),
});

export const ListBedsToolOutputSchema = z.object({ beds: z.array(ToolBedSchema) });

/** A planting as the model reads it: plant name instead of id, period instead of three dates. */
const ToolPlantingSchema = z.object({
  id: UlidSchema,
  plant: z.string(),
  kind: z.enum(['SINGLE', 'ROW']),
  x: z.number(),
  y: z.number(),
  lengthCm: z.number().optional(),
  orientation: DirectionSchema.optional(),
  from: IsoDateSchema,
  /** Removal, else the planned end; null for perennials. */
  until: IsoDateSchema.nullable(),
});

export const GetBedToolOutputSchema = z.object({
  bed: ToolBedSchema.extend({ mainRowDirection: DirectionSchema }),
  plantings: z.array(ToolPlantingSchema),
});

const ToolPlantSchema = z.object({
  id: UlidSchema,
  name: z.string(),
  category: CategorySchema,
  family: z.string(),
  feeder: FeederSchema,
  spacingInRowCm: z.number(),
  rowSpacingCm: z.number(),
  lifecycle: LifecycleSchema,
  goodNeighbors: z.array(z.string()),
  badNeighbors: z.array(z.string()),
  own: z.boolean(),
});

export const FindPlantsToolOutputSchema = z.object({
  plants: z.array(ToolPlantSchema),
  /** Matches left out because of the limit. */
  more: z.number().int().min(0),
});

export const EvaluateBedToolOutputSchema = z.object({
  findings: z.array(
    z.object({
      severity: z.enum(['WARNING', 'HINT', 'POSITIVE']),
      message: z.string(),
      plants: z.array(z.string()),
      from: IsoDateSchema,
      until: IsoDateSchema.nullable(),
    }),
  ),
});

/** What a tool returns when it cannot answer: a German message the agent passes on. */
export const ToolErrorSchema = z.object({ error: z.string() });

export type ListBedsToolOutput = z.infer<typeof ListBedsToolOutputSchema>;
export type GetBedToolOutput = z.infer<typeof GetBedToolOutputSchema>;
export type FindPlantsToolOutput = z.infer<typeof FindPlantsToolOutputSchema>;
export type EvaluateBedToolOutput = z.infer<typeof EvaluateBedToolOutputSchema>;
export type ToolError = z.infer<typeof ToolErrorSchema>;

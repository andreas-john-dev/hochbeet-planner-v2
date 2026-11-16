import { z } from 'zod';
import { LOCALES, type Locale, messageKey } from '../messages';
import {
  CategorySchema,
  FeederSchema,
  LifecycleSchema,
  PositiveGridCmSchema,
  SowingMethodSchema,
  SowingStageSchema,
} from '../domain';
import { DirectionSchema, GridCmSchema, IsoDateSchema, UlidSchema } from '../primitives';
import { MonthDaySchema } from './garden';

// Beet-Assistent on Bedrock AgentCore (docs/architecture/assistant.md). The agent is
// Python (agents/bed-assistant); its pydantic model mirrors this schema, and infra passes the
// limit below to it, so both sides check the same length.

/** Cognito groups that may use the assistant; infra's stage config and the app use these. */
export const ASSISTANT_GROUPS = ['ai-testers', 'admins'] as const;

/** Header with the runtime session id (at least 33 characters), sent with every question. */
export const ASSISTANT_SESSION_HEADER = 'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id';

/** Longest question the assistant accepts. */
export const MAX_ASSISTANT_MESSAGE_CHARS = 2000;

/**
 * What the assistant answers when its guardrail blocks a question (`input`, also the agent's
 * fallback) or an answer (`output`). The guardrail itself knows one text per case: infra
 * configures it with the German ones, and the agent replaces them with the request's language.
 * The mock answers with `input`.
 */
export const ASSISTANT_BLOCKED_MESSAGES = {
  de: {
    input:
      'Dabei kann ich dir leider nicht helfen. Frag mich gern etwas zu deinen Beeten, Pflanzen oder zur Anzucht.',
    output:
      'Diese Antwort kann ich dir leider nicht geben. Frag mich gern etwas anderes zu deinen Beeten und Pflanzen.',
  },
  en: {
    input:
      "Sorry, I can't help you with that. Feel free to ask me about your beds, plants or raising seedlings.",
    output:
      "Sorry, I can't give you that answer. Feel free to ask me something else about your beds and plants.",
  },
} as const satisfies Record<Locale, { input: string; output: string }>;

/** Language of the assistant's answers and messages: the app's language, German by default. */
export const AssistantLanguageSchema = z.enum(LOCALES);

/**
 * Body of a request to the runtime: the question, optionally with the bed the user is looking
 * at. The agent reads the bed itself through the gateway tools (below).
 */
export const AssistantRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, messageKey('questionRequired'))
    .max(
      MAX_ASSISTANT_MESSAGE_CHARS,
      messageKey('questionTooLong', { max: MAX_ASSISTANT_MESSAGE_CHARS }),
    ),
  bedId: UlidSchema.optional(),
  /** Asks for checked planting suggestions for `bedId` instead of a plain answer. */
  suggest: z.boolean().optional(),
  /**
   * The app's language: the assistant answers in it unless the user clearly writes in the
   * other one, and its messages, suggestions and tool texts use it. German without it.
   */
  language: AssistantLanguageSchema.optional(),
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

/**
 * Days the assistant keeps conversations (AgentCore Memory events); the shortest retention it
 * allows. Infra configures the memory with it, the profile names it.
 */
export const ASSISTANT_CONVERSATION_DAYS = 7;

/**
 * Body of a request about the assistant's long-term memory (T-44), on the same path as the
 * questions: `list` returns the user's remembered preferences, `forget` deletes everything the
 * assistant has stored about the user. Neither counts against the daily quota.
 */
export const AssistantMemoryRequestSchema = z.object({
  memory: z.enum(['list', 'forget']),
  /** Language of the runtime's error messages; German without it. */
  language: AssistantLanguageSchema.optional(),
});
export type AssistantMemoryRequest = z.infer<typeof AssistantMemoryRequestSchema>;

/** One preference the assistant remembers, as AgentCore Memory extracted it. */
export const AssistantMemorySchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
});
export type AssistantMemory = z.infer<typeof AssistantMemorySchema>;

/** Answer to `{ memory: 'list' }`: newest first. */
export const AssistantMemoriesResponseSchema = z.object({
  memories: z.array(AssistantMemorySchema),
});
export type AssistantMemoriesResponse = z.infer<typeof AssistantMemoriesResponseSchema>;

/** Answer to `{ memory: 'forget' }`: how many preferences and conversation events were deleted. */
export const AssistantForgetResponseSchema = z.object({
  memories: z.number().int().min(0),
  events: z.number().int().min(0),
});
export type AssistantForgetResponse = z.infer<typeof AssistantForgetResponseSchema>;

/** Most suggestions one answer may carry. */
export const MAX_SUGGESTIONS = 6;

/**
 * A planting the assistant suggests, as the model writes it (structured output). The end
 * follows from the plant's lifecycle when the user takes it over. Exported as JSON Schema to
 * `schemas/` (`pnpm --filter @hochbeet/contracts schemas`); the agent generates its pydantic
 * model from there.
 */
export const SuggestionSchema = z.object({
  plantId: UlidSchema.describe('ID der Sorte aus find_plants.'),
  kind: z.enum(['SINGLE', 'ROW']).describe('SINGLE: Einzelpflanze, ROW: Reihe.'),
  x: GridCmSchema.describe('Position in cm vom linken Beetrand, Vielfaches von 5.'),
  y: GridCmSchema.describe('Position in cm vom oberen Beetrand, Vielfaches von 5.'),
  lengthCm: PositiveGridCmSchema.optional().describe('Nur für Reihen: Länge in cm.'),
  orientation: DirectionSchema.optional().describe('Nur für Reihen: H waagerecht, V senkrecht.'),
  startDate: IsoDateSchema.describe('Montag der Pflanzwoche (JJJJ-MM-TT).'),
  reason: z.string().min(1).max(300).describe('Kurze Begründung in der Antwortsprache.'),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

/** The structured answer of the suggestion mode. */
export const SuggestionListSchema = z.object({
  suggestions: z.array(SuggestionSchema).max(MAX_SUGGESTIONS),
  summary: z
    .string()
    .max(800)
    .describe('Kurze Zusammenfassung der Vorschläge in der Antwortsprache.'),
});
export type SuggestionList = z.infer<typeof SuggestionListSchema>;

/**
 * One server-sent event of the answer stream (`data: <json>`): text chunks, then `done` with
 * the questions left today, or `error` with a message in the request's language if the model
 * failed midway.
 */
export const AssistantEventSchema = z.union([
  z.object({ text: z.string() }),
  // Checked suggestions plus the warnings the rule engine still reports for them.
  z.object({ suggestions: z.array(SuggestionSchema), warnings: z.array(z.string()) }),
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

/** A planting to check together with the bed before it exists (suggestions). */
export const CandidatePlantingSchema = SuggestionSchema.omit({ reason: true });
export type CandidatePlanting = z.infer<typeof CandidatePlantingSchema>;

export const EvaluateBedToolInputSchema = GetBedToolInputSchema.extend({
  week: IsoDateSchema.optional().describe(
    'Ein Tag (JJJJ-MM-TT) der Woche, für die die Hinweise gelten sollen. Ohne Angabe: alle Hinweise der Beet-Historie.',
  ),
  candidates: z
    .array(CandidatePlantingSchema)
    .max(MAX_SUGGESTIONS)
    .optional()
    .describe('Geplante Pflanzungen, die zusammen mit dem Beet geprüft werden sollen.'),
});

export const FindPlantsToolInputSchema = z.object({
  query: z
    .string()
    .trim()
    .max(50)
    .optional()
    .describe(
      'Teil des Sortennamens, deutsch oder englisch, z. B. "Tomate". Ohne Angabe: alle Sorten.',
    ),
});

export const ListSowingsToolInputSchema = z.object({
  query: z
    .string()
    .trim()
    .max(50)
    .optional()
    .describe('Teil des Sortennamens, z. B. "Salat". Ohne Angabe: alle Chargen.'),
});

export type ListBedsToolInput = z.infer<typeof ListBedsToolInputSchema>;
export type GetBedToolInput = z.infer<typeof GetBedToolInputSchema>;
export type EvaluateBedToolInput = z.infer<typeof EvaluateBedToolInputSchema>;
export type FindPlantsToolInput = z.infer<typeof FindPlantsToolInputSchema>;
export type ListSowingsToolInput = z.infer<typeof ListSowingsToolInputSchema>;

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
  /**
   * Bounding box of the area the planting occupies (Standfläche, as the spacing rule sees it),
   * so the model can place suggestions on free ground. Missing for unknown plants.
   */
  area: z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }).optional(),
});

export const GetBedToolOutputSchema = z.object({
  bed: ToolBedSchema.extend({ mainRowDirection: DirectionSchema }),
  plantings: z.array(ToolPlantingSchema),
});

const ToolPlantSchema = z.object({
  id: UlidSchema,
  name: z.string(),
  /** English name (`plantName(plant, 'en')`): the German one for own plants and adjusted names. */
  nameEn: z.string(),
  category: CategorySchema,
  family: z.string(),
  /** English family, like `nameEn`. */
  familyEn: z.string(),
  feeder: FeederSchema,
  spacingInRowCm: z.number(),
  rowSpacingCm: z.number(),
  lifecycle: LifecycleSchema,
  goodNeighbors: z.array(z.string()),
  badNeighbors: z.array(z.string()),
  own: z.boolean(),
  /** Goes outside only after the last frost. */
  frostSensitive: z.boolean(),
  /** Sowing and raising, readable: windows with months, durations in weeks. */
  sowing: z
    .object({
      method: SowingMethodSchema,
      /** E.g. "KW 10–14 (Anfang März bis Anfang April)". */
      presow: z.string().optional(),
      /** Weeks from sowing to planting out, e.g. "6–8". */
      propagationWeeks: z.string().optional(),
      prickOutWeeks: z.number().int().optional(),
      directSow: z.string().optional(),
    })
    .optional(),
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
      /** Indexes of the candidates this finding involves; empty for the bed alone. */
      candidates: z.array(z.number().int().min(0)),
    }),
  ),
  /** Indexes of candidates with an unknown plant; they were not checked. */
  unknownCandidates: z.array(z.number().int().min(0)),
});

/** A sowing batch as the model reads it: plant name, week and what is left of it. */
const ToolSowingSchema = z.object({
  plant: z.string(),
  /** Monday of the week it is (or will be) sown. */
  sowWeek: IsoDateSchema,
  stage: SowingStageSchema,
  /** Seeds planned or sown before germination, seedlings alive afterwards. */
  stock: z.number().int().min(0),
  /** Plants of the plantings linked to the batch; missing for unknown plants. */
  planned: z.number().int().min(0).optional(),
  /** Stock minus planned; negative when more is planned than there is. */
  free: z.number().int().optional(),
  plannedTransplantWeek: IsoDateSchema.optional(),
  location: z.string().optional(),
});

export const ListSowingsToolOutputSchema = z.object({
  /** The user's last frost (`MM-DD`), for when frost sensitive plants may go out. */
  lastFrost: MonthDaySchema,
  sowings: z.array(ToolSowingSchema),
  /** Batches left out because of the limit. */
  more: z.number().int().min(0),
});

/**
 * What a tool returns when it cannot answer: a message in the request's language (from the
 * agent's `Accept-Language`, see services/assistant-tools) that the agent passes on.
 */
export const ToolErrorSchema = z.object({ error: z.string() });

export type ListBedsToolOutput = z.infer<typeof ListBedsToolOutputSchema>;
export type GetBedToolOutput = z.infer<typeof GetBedToolOutputSchema>;
export type FindPlantsToolOutput = z.infer<typeof FindPlantsToolOutputSchema>;
export type EvaluateBedToolOutput = z.infer<typeof EvaluateBedToolOutputSchema>;
export type ListSowingsToolOutput = z.infer<typeof ListSowingsToolOutputSchema>;
export type ToolError = z.infer<typeof ToolErrorSchema>;

import {
  ASSISTANT_GROUPS,
  type AssistantEvent,
  type AssistantForgetResponse,
  type AssistantMemoriesResponse,
  AssistantMemoryRequestSchema,
  AssistantRequestSchema,
  type Suggestion,
} from '@hochbeet/contracts';
import { error, json, parseJson, route, type Route } from '@/lib/local-api/router';
import { ASSISTANT_PATH } from '@/lib/assistant';
import type { MockUser } from './handlers';
import type { MockStore } from './store';

/** Questions per day, like the agent's default quota. */
export const MOCK_ASSISTANT_DAILY_LIMIT = 20;

/** Pause between two chunks, so the answer visibly streams in and can be cancelled. */
const CHUNK_DELAY_MS = 150;

/** The fixed answer of the mock, in chunks; mentions the bed when the question has one. */
export function mockAnswer(bedId: string | undefined): string[] {
  return [
    'Gern! ',
    ...(bedId ? ['Ich habe mir dein Beet angesehen. '] : []),
    'Tomaten vertragen sich gut mit Basilikum, ',
    'halte aber 50 cm Abstand zwischen den Pflanzen.',
  ];
}

/**
 * Fixed suggestions of the mock (free spots of the e2e example bed, week of 5 October 2026):
 * a lettuce and a row of radishes.
 */
export const MOCK_SUGGESTIONS: Suggestion[] = [
  {
    plantId: '01M49THV00RK9E9PC83NEE87CJ',
    kind: 'SINGLE',
    x: 130,
    y: 50,
    startDate: '2026-10-05',
    reason: 'Kopfsalat wächst schnell und füllt die Lücke zwischen den Reihen.',
  },
  {
    plantId: '01M49THV00NAC3VGAMQF7XGNWF',
    kind: 'ROW',
    x: 145,
    y: 35,
    orientation: 'V',
    lengthCm: 30,
    startDate: '2026-10-05',
    reason: 'Radieschen sind nach wenigen Wochen erntereif.',
  },
];

export const MOCK_SUGGESTION_SUMMARY = 'Zwei Vorschläge für die freie Fläche in der Mitte.';

const sse = (event: AssistantEvent) => `data: ${JSON.stringify(event)}\n\n`;

/**
 * Statements about the user ("Ich mag keinen Fenchel.") are what the real memory extracts
 * preferences from; the mock simply remembers them as they are.
 */
export const isPreference = (message: string) => /^ich\b/i.test(message.trim());

/**
 * The Beet-Assistent without AWS for the dev server and Playwright: same checks and statuses
 * as the agent (403 without group, 400, 429 over the daily limit), then a fixed answer as
 * server-sent events, chunk by chunk. Lists and forgets remembered preferences like the agent
 * (without counting questions).
 */
export function assistantRoutes(store: MockStore, user: MockUser): Route[] {
  return [
    route('POST', ASSISTANT_PATH, async ({ request }) => {
      if (!user.groups.some((g) => (ASSISTANT_GROUPS as readonly string[]).includes(g))) {
        return error('Der Assistent ist noch nicht für dein Konto freigeschaltet.', 403);
      }
      const raw: unknown = await request
        .clone()
        .json()
        .catch(() => undefined);
      if (raw && typeof raw === 'object' && 'memory' in raw) {
        const memory = await parseJson(request, AssistantMemoryRequestSchema);
        if (memory.response) return memory.response;
        if (memory.data.memory === 'list') {
          return json<AssistantMemoriesResponse>({ memories: store.readMemories(user.id) });
        }
        return json<AssistantForgetResponse>({ memories: store.forget(user.id), events: 0 });
      }
      const parsed = await parseJson(request, AssistantRequestSchema);
      if (parsed.response) return parsed.response;
      if (parsed.data.suggest && !parsed.data.bedId) {
        return error('Für Pflanzvorschläge brauche ich ein Beet.', 400);
      }
      const remaining = store.takeAssistantQuestion(
        user.id,
        new Date().toISOString().slice(0, 10),
        MOCK_ASSISTANT_DAILY_LIMIT,
      );
      if (remaining === undefined) {
        return error(
          `Du hast heute schon ${String(MOCK_ASSISTANT_DAILY_LIMIT)} Fragen gestellt. Morgen geht es weiter.`,
          429,
        );
      }
      const suggest = parsed.data.suggest === true && parsed.data.bedId !== undefined;
      if (!suggest && isPreference(parsed.data.message)) {
        store.remember(user.id, {
          id: crypto.randomUUID(),
          text: parsed.data.message,
          createdAt: new Date().toISOString(),
        });
      }
      const chunks = suggest ? [MOCK_SUGGESTION_SUMMARY] : mockAnswer(parsed.data.bedId);
      const encoder = new TextEncoder();
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const text of chunks) {
            await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
            if (cancelled) return;
            controller.enqueue(encoder.encode(sse({ text })));
          }
          if (suggest) {
            controller.enqueue(
              encoder.encode(sse({ suggestions: MOCK_SUGGESTIONS, warnings: [] })),
            );
          }
          controller.enqueue(encoder.encode(sse({ done: true, remaining })));
          controller.close();
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(body, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }),
  ];
}

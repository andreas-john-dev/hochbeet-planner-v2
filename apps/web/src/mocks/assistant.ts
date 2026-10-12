import { ASSISTANT_GROUPS, type AssistantEvent, AssistantRequestSchema } from '@hochbeet/contracts';
import { error, parseJson, route, type Route } from '@/lib/local-api/router';
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

const sse = (event: AssistantEvent) => `data: ${JSON.stringify(event)}\n\n`;

/**
 * The Beet-Assistent without AWS for the dev server and Playwright: same checks and statuses
 * as the agent (403 without group, 400, 429 over the daily limit), then a fixed answer as
 * server-sent events, chunk by chunk.
 */
export function assistantRoutes(store: MockStore, user: MockUser): Route[] {
  return [
    route('POST', ASSISTANT_PATH, async ({ request }) => {
      if (!user.groups.some((g) => (ASSISTANT_GROUPS as readonly string[]).includes(g))) {
        return error('Der Assistent ist noch nicht für dein Konto freigeschaltet.', 403);
      }
      const parsed = await parseJson(request, AssistantRequestSchema);
      if (parsed.response) return parsed.response;
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
      const chunks = mockAnswer(parsed.data.bedId);
      const encoder = new TextEncoder();
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const text of chunks) {
            await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
            if (cancelled) return;
            controller.enqueue(encoder.encode(sse({ text })));
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

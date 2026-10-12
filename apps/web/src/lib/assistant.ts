import {
  ASSISTANT_GROUPS,
  ASSISTANT_SESSION_HEADER,
  type AssistantEvent,
  AssistantEventSchema,
  type AssistantRequest,
} from '@hochbeet/contracts';
import { ApiError, type ApiStream } from './api';
import type { AuthUser } from './auth/types';

/** Path of the assistant on the app's domain; CloudFront maps it to the AgentCore Runtime. */
export const ASSISTANT_PATH = '/api/assistant/invocations';

const INTERRUPTED = 'Die Antwort wurde unterbrochen. Bitte versuche es noch einmal.';

/** Only signed-in members of the allowed groups see the chat; guests never do. */
export function canUseAssistant(user: AuthUser | null, guest: boolean): boolean {
  if (guest || !user) return false;
  return user.groups.some((group) => (ASSISTANT_GROUPS as readonly string[]).includes(group));
}

/** A runtime session id; the runtime needs at least 33 characters. One per chat. */
export const newSessionId = () => `chat-${crypto.randomUUID()}`;

/**
 * Events of a server-sent event stream (`data: <json>` blocks separated by a blank line),
 * parsed against the contract. Unknown or broken events are skipped. Aborting `signal`
 * cancels the stream.
 */
export async function* assistantEvents(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<AssistantEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', cancel);
  let buffer = '';
  const parse = (block: string) => {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return undefined;
    try {
      const result = AssistantEventSchema.safeParse(JSON.parse(data));
      return result.success ? result.data : undefined;
    } catch {
      return undefined;
    }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n');
      let end = buffer.indexOf('\n\n');
      while (end !== -1) {
        const event = parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        if (event) yield event;
        end = buffer.indexOf('\n\n');
      }
    }
    const last = parse(buffer);
    if (last) yield last;
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

export interface AskOptions extends AssistantRequest {
  sessionId: string;
  signal?: AbortSignal;
  /** Called with every text chunk as it arrives. */
  onText: (text: string) => void;
}

/**
 * Asks the assistant and streams the answer into `onText`. Resolves with the questions left
 * today; throws `ApiError` (German `message`) for refusals such as 429 and for an answer that
 * failed or broke off midway, and an `AbortError` when `signal` aborts.
 */
export async function askAssistant(
  stream: ApiStream,
  { message, bedId, sessionId, signal, onText }: AskOptions,
): Promise<{ remaining: number }> {
  const response = await stream(ASSISTANT_PATH, {
    method: 'POST',
    headers: { [ASSISTANT_SESSION_HEADER]: sessionId, Accept: 'text/event-stream' },
    body: JSON.stringify(bedId ? { message, bedId } : { message }),
    ...(signal ? { signal } : {}),
  });
  if (!response.body) throw new ApiError(502, { message: INTERRUPTED });
  for await (const event of assistantEvents(response.body, signal)) {
    signal?.throwIfAborted();
    if ('text' in event) onText(event.text);
    else if ('error' in event) throw new ApiError(502, { message: event.error });
    else return { remaining: event.remaining };
  }
  signal?.throwIfAborted();
  throw new ApiError(502, { message: INTERRUPTED });
}

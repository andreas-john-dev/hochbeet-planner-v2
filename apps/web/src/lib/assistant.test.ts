import { ASSISTANT_SESSION_HEADER } from '@hochbeet/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createMockFetch } from '@/mocks/fetch';
import { MockStore } from '@/mocks/store';
import {
  MOCK_ASSISTANT_DAILY_LIMIT,
  MOCK_SUGGESTION_SUMMARY,
  MOCK_SUGGESTIONS,
  mockAnswer,
} from '@/mocks/assistant';
import { ApiError, apiErrorMessage, createApiClient, createApiStream } from './api';
import {
  ASSISTANT_PATH,
  askAssistant,
  assistantEvents,
  canUseAssistant,
  newSessionId,
} from './assistant';

const BED = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';

/** A response body that delivers `parts` one by one, like a network stream. */
function body(parts: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

const streamOf = (response: Response) =>
  createApiStream(
    () => Promise.resolve('t'),
    () => Promise.resolve(response),
  );

async function collect(stream: ReadableStream<Uint8Array>) {
  const events = [];
  for await (const event of assistantEvents(stream)) events.push(event);
  return events;
}

describe('assistant access', () => {
  it('is for signed-in ai-testers and admins only, never for guests', () => {
    const user = (groups: string[]) => ({ userId: 'u', email: 'u@example.com', groups });
    expect(canUseAssistant(user(['ai-testers']), false)).toBe(true);
    expect(canUseAssistant(user(['admins']), false)).toBe(true);
    expect(canUseAssistant(user([]), false)).toBe(false);
    expect(canUseAssistant(user(['others']), false)).toBe(false);
    expect(canUseAssistant(null, true)).toBe(false);
  });

  it('creates session ids long enough for the runtime', () => {
    expect(newSessionId().length).toBeGreaterThanOrEqual(33);
    expect(newSessionId()).not.toBe(newSessionId());
  });
});

describe('assistantEvents', () => {
  it('parses events even when they arrive split across chunks', async () => {
    const events = await collect(
      body([
        'data: {"te',
        'xt":"Hal"}\n',
        '\ndata: {"text":"lo"}\r\n\r\n',
        'data: {"done":true,"remaining":3}',
      ]),
    );
    expect(events).toEqual([{ text: 'Hal' }, { text: 'lo' }, { done: true, remaining: 3 }]);
  });

  it('skips broken and unknown events', async () => {
    expect(await collect(body(['data: kaputt\n\n', 'data: {"foo":1}\n\n', ': ping\n\n']))).toEqual(
      [],
    );
  });
});

describe('askAssistant', () => {
  const sse = (...events: object[]) =>
    new Response(body(events.map((e) => `data: ${JSON.stringify(e)}\n\n`)), {
      headers: { 'Content-Type': 'text/event-stream' },
    });

  it('streams the text and returns the questions left', async () => {
    const chunks: string[] = [];
    const fetchFn = vi.fn(() =>
      Promise.resolve(sse({ text: 'Gern' }, { text: '!' }, { done: true, remaining: 4 })),
    );
    const result = await askAssistant(
      createApiStream(() => Promise.resolve('tok'), fetchFn),
      {
        message: 'Hallo',
        bedId: BED,
        sessionId: 's'.repeat(40),
        onText: (t) => chunks.push(t),
      },
    );
    expect(result).toEqual({ remaining: 4 });
    expect(chunks).toEqual(['Gern', '!']);
    const [path, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/assistant/invocations');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok');
    expect(headers.get(ASSISTANT_SESSION_HEADER)).toBe('s'.repeat(40));
    expect(JSON.parse(init.body as string)).toEqual({ message: 'Hallo', bedId: BED });
  });

  it('turns refusals and failures into German messages', async () => {
    const refused = Response.json(
      { message: 'Du hast heute schon 20 Fragen gestellt.' },
      {
        status: 429,
      },
    );
    const error = await askAssistant(streamOf(refused), {
      message: 'Hi',
      sessionId: 'x',
      onText: () => undefined,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(apiErrorMessage(error)).toBe('Du hast heute schon 20 Fragen gestellt.');

    await expect(
      askAssistant(streamOf(sse({ text: 'Teil' }, { error: 'Gerade nicht erreichbar.' })), {
        message: 'Hi',
        sessionId: 'x',
        onText: () => undefined,
      }).catch(apiErrorMessage),
    ).resolves.toBe('Gerade nicht erreichbar.');

    await expect(
      askAssistant(streamOf(sse({ text: 'Teil' })), {
        message: 'Hi',
        sessionId: 'x',
        onText: () => undefined,
      }).catch(apiErrorMessage),
    ).resolves.toMatch(/unterbrochen/);
  });

  it('a 429 without message still explains itself', () => {
    expect(apiErrorMessage(new ApiError(429, undefined))).toMatch(/Zu viele Anfragen/);
  });
});

describe('mock assistant', () => {
  const token = (groups: string) => `mock-id-token.a@example.com${groups}`;
  const ask = (fetchFn: typeof fetch, groups = '|admins', signal?: AbortSignal) =>
    askAssistant(
      createApiStream(() => Promise.resolve(token(groups)), fetchFn),
      {
        message: 'Was passt zu Tomaten?',
        bedId: BED,
        sessionId: newSessionId(),
        onText: () => undefined,
        ...(signal ? { signal } : {}),
      },
    );

  it('streams the fixed answer and counts down the daily quota', async () => {
    const fetchFn = createMockFetch(new MockStore(new MemoryStorage()));
    const chunks: string[] = [];
    const result = await askAssistant(
      createApiStream(() => Promise.resolve(token('|ai-testers')), fetchFn),
      { message: 'Hi', bedId: BED, sessionId: newSessionId(), onText: (t) => chunks.push(t) },
    );
    expect(chunks).toEqual(mockAnswer(BED));
    expect(result.remaining).toBe(MOCK_ASSISTANT_DAILY_LIMIT - 1);
  });

  it('refuses users without group (403) and over the limit (429)', async () => {
    const store = new MockStore(new MemoryStorage());
    const fetchFn = createMockFetch(store);
    await expect(ask(fetchFn, '').catch(apiErrorMessage)).resolves.toMatch(/nicht für dein Konto/);
    for (let i = 0; i < MOCK_ASSISTANT_DAILY_LIMIT; i++) {
      store.takeAssistantQuestion('a@example.com', new Date().toISOString().slice(0, 10), 99);
    }
    await expect(ask(fetchFn).catch(apiErrorMessage)).resolves.toMatch(/schon 20 Fragen gestellt/);
  });

  it('answers a suggestion request with text, checked suggestions and done', async () => {
    const fetchFn = createMockFetch(new MockStore(new MemoryStorage()));
    const chunks: string[] = [];
    const received: unknown[] = [];
    const result = await askAssistant(
      createApiStream(() => Promise.resolve(token('|admins')), fetchFn),
      {
        message: 'Was passt noch?',
        bedId: BED,
        suggest: true,
        sessionId: newSessionId(),
        onText: (t) => chunks.push(t),
        onSuggestions: (suggestions, warnings) => received.push({ suggestions, warnings }),
      },
    );
    expect(chunks).toEqual([MOCK_SUGGESTION_SUMMARY]);
    expect(received).toEqual([{ suggestions: MOCK_SUGGESTIONS, warnings: [] }]);
    expect(result.remaining).toBe(MOCK_ASSISTANT_DAILY_LIMIT - 1);
  });

  it('stops streaming when the question is cancelled', async () => {
    const fetchFn = createMockFetch(new MockStore(new MemoryStorage()));
    const controller = new AbortController();
    const pending = ask(fetchFn, '|admins', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

describe('mock assistant memory', () => {
  const token = (email: string) => `mock-id-token.${email}|admins`;
  const client = (fetchFn: typeof fetch, email: string) =>
    createApiClient(() => Promise.resolve(token(email)), fetchFn);
  const memory = (fetchFn: typeof fetch, email: string, action: 'list' | 'forget') =>
    client(fetchFn, email)<unknown>(ASSISTANT_PATH, {
      method: 'POST',
      body: JSON.stringify({ memory: action }),
    });
  const tell = (fetchFn: typeof fetch, email: string, message: string) =>
    askAssistant(
      createApiStream(() => Promise.resolve(token(email)), fetchFn),
      {
        message,
        sessionId: newSessionId(),
        onText: () => undefined,
      },
    );

  it('remembers statements about the user, for that user only, without using quota', async () => {
    const store = new MockStore(new MemoryStorage());
    const fetchFn = createMockFetch(store);
    await tell(fetchFn, 'a@example.com', 'Ich mag keinen Fenchel.');
    await tell(fetchFn, 'a@example.com', 'Was passt zu Tomaten?');
    await tell(fetchFn, 'b@example.com', 'Ich gärtnere in Hamburg.');
    const listed = await memory(fetchFn, 'a@example.com', 'list');
    expect(listed).toEqual({
      memories: [expect.objectContaining({ text: 'Ich mag keinen Fenchel.' })],
    });
    await memory(fetchFn, 'a@example.com', 'list');
    const day = new Date().toISOString().slice(0, 10);
    // Two questions so far (this is the third); listing did not count.
    expect(store.takeAssistantQuestion('a@example.com', day, 99)).toBe(99 - 3);
  });

  it('forgets everything about the user and nothing about others', async () => {
    const store = new MockStore(new MemoryStorage());
    const fetchFn = createMockFetch(store);
    await tell(fetchFn, 'a@example.com', 'Ich mag keinen Fenchel.');
    await tell(fetchFn, 'b@example.com', 'Ich gärtnere in Hamburg.');
    expect(await memory(fetchFn, 'a@example.com', 'forget')).toEqual({ memories: 1, events: 0 });
    expect(await memory(fetchFn, 'a@example.com', 'list')).toEqual({ memories: [] });
    expect(store.readMemories('b@example.com')).toHaveLength(1);
  });
});

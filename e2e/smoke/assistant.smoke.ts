import { expect, type Page, test } from '@playwright/test';

// The Beet-Assistent on Bedrock AgentCore (T-40, T-41, T-44): the smoke user (group ai-testers)
// asks one short question, which uses one of the user's daily questions, then lists and deletes
// what the assistant remembers about it; the tool gateway lists its tools and reads the smoke
// user's beds without any model call. Requests without a token are refused.

const email = process.env.SMOKE_USER_EMAIL;
const password = process.env.SMOKE_USER_PASSWORD;
const runtimeArn = process.env.SMOKE_ASSISTANT_ARN;
const gatewayUrl = process.env.SMOKE_ASSISTANT_GATEWAY_URL;

/** Invocation URL of the runtime, from its ARN (`arn:aws:bedrock-agentcore:<region>:…`). */
const invocationUrl = (arn: string) =>
  `https://bedrock-agentcore.${arn.split(':')[3] ?? ''}.amazonaws.com/runtimes/${encodeURIComponent(arn)}/invocations?qualifier=DEFAULT`;

/** Runtime sessions need an id of at least 33 characters. */
const sessionId = () => `smoke-${String(Date.now())}-${'x'.repeat(30)}`;

/** Signs in like a user and returns the Cognito ID token the app keeps in localStorage. */
async function signIn(page: Page): Promise<string> {
  await page.goto('/anmelden');
  await page.getByLabel('E-Mail').fill(email ?? '');
  await page.getByLabel('Passwort', { exact: true }).fill(password ?? '');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible({
    timeout: 20_000,
  });
  // Amplify keeps the Cognito tokens in localStorage (`….idToken`).
  const idToken = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.endsWith('.idToken'));
    return key ? localStorage.getItem(key) : null;
  });
  expect(idToken).toBeTruthy();
  return idToken ?? '';
}

test.describe('assistant runtime', () => {
  test.skip(!runtimeArn, 'SMOKE_ASSISTANT_ARN is not set');
  // One project is enough: the runtime does not care about the viewport.
  test.skip(({ isMobile }) => isMobile, 'Runs on desktop only.');

  test('refuses requests without a token', async ({ request }) => {
    const response = await request.post(invocationUrl(runtimeArn ?? ''), {
      headers: { 'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId() },
      data: { message: 'Hallo' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('is reachable on the app domain only for its invocation path', async ({ request }) => {
    // CloudFront (T-42): other paths and methods end at the rewrite function.
    expect((await request.get('/api/assistant/invocations')).status()).toBe(404);
    const unsigned = await request.post('/api/assistant/invocations', {
      headers: { 'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId() },
      data: { message: 'Hallo' },
    });
    expect([401, 403]).toContain(unsigned.status());
  });

  // The way the app asks: same domain, through CloudFront to the runtime.
  test('answers the smoke user through the app domain', async ({ page }) => {
    test.skip(!email || !password, 'SMOKE_USER_EMAIL and SMOKE_USER_PASSWORD are not set');
    test.setTimeout(90_000);
    const idToken = await signIn(page);

    const response = await page.request.post('/api/assistant/invocations', {
      headers: {
        Authorization: `Bearer ${idToken}`,
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId(),
      },
      data: { message: 'Antworte nur mit dem Wort: Radieschen' },
      timeout: 60_000,
    });
    const body = await response.text();
    expect(response.status(), body).toBe(200);
    expect(response.headers()['content-type']).toContain('text/event-stream');
    expect(body).toContain('"text"');
    expect(body).toMatch(/"done": ?true/);
  });

  // Memory (T-44): reading and deleting the smoke user's own memory, without a model call.
  test('lists and forgets what it remembers about the smoke user', async ({ page }) => {
    test.skip(!email || !password, 'SMOKE_USER_EMAIL and SMOKE_USER_PASSWORD are not set');
    test.setTimeout(90_000);
    const idToken = await signIn(page);
    const memory = (action: 'list' | 'forget') =>
      page.request.post('/api/assistant/invocations', {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId(),
        },
        data: { memory: action },
        timeout: 60_000,
      });

    const listed = await memory('list');
    expect(listed.status(), await listed.text()).toBe(200);
    expect(Array.isArray(((await listed.json()) as { memories: unknown }).memories)).toBe(true);
    // Also cleans up the conversation of the question above.
    const forgotten = await memory('forget');
    expect(forgotten.status(), await forgotten.text()).toBe(200);
    const counts = (await forgotten.json()) as { memories: unknown; events: unknown };
    expect([typeof counts.memories, typeof counts.events]).toEqual(['number', 'number']);
  });
});

interface JsonRpcResponse {
  result?: {
    tools?: { name: string }[];
    content?: { type: string; text: string }[];
    isError?: boolean;
  };
  error?: { message: string };
}

test.describe('assistant tool gateway', () => {
  test.skip(!gatewayUrl, 'SMOKE_ASSISTANT_GATEWAY_URL is not set');
  test.skip(({ isMobile }) => isMobile, 'Runs on desktop only.');

  test('refuses requests without a token', async ({ request }) => {
    const response = await request.post(gatewayUrl ?? '', {
      headers: { Accept: 'application/json, text/event-stream' },
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('lists the tools and reads the smoke user’s beds with their token', async ({ page }) => {
    test.skip(!email || !password, 'SMOKE_USER_EMAIL and SMOKE_USER_PASSWORD are not set');
    test.setTimeout(60_000);
    const idToken = await signIn(page);
    let sessionHeader: Record<string, string> = {};

    /** One MCP request over streamable HTTP; the answer is JSON or a single SSE event. */
    const rpc = async (id: number, method: string, params?: object) => {
      const response = await page.request.post(gatewayUrl ?? '', {
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
          ...sessionHeader,
        },
        data: { jsonrpc: '2.0', id, method, ...(params ? { params } : {}) },
      });
      const body = await response.text();
      expect(response.status(), body).toBe(200);
      const session = response.headers()['mcp-session-id'];
      if (session) sessionHeader = { 'Mcp-Session-Id': session };
      const json = body.trimStart().startsWith('{')
        ? body
        : (body
            .split('\n')
            .find((line) => line.startsWith('data:'))
            ?.slice(5) ?? '{}');
      return JSON.parse(json) as JsonRpcResponse;
    };

    await rpc(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'smoke', version: '1' },
    });
    const listed = await rpc(2, 'tools/list');
    const names = (listed.result?.tools ?? []).map((tool) => tool.name);
    for (const tool of ['list_beds', 'get_bed', 'find_plants', 'evaluate_bed']) {
      expect(names).toContain(`garden___${tool}`);
    }

    // The interceptor hands the user's token to the tool, which reads through the garden API.
    const called = await rpc(3, 'tools/call', { name: 'garden___list_beds', arguments: {} });
    const text = called.result?.content?.[0]?.text ?? '';
    expect(called.result?.isError ?? false, text).toBe(false);
    // A tool error would read {"error": "Bitte melde dich an."}: the token did not arrive.
    expect(text).toContain('"beds"');
  });
});

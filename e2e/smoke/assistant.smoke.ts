import { expect, test } from '@playwright/test';

// The Beet-Assistent on Bedrock AgentCore (T-40): the smoke user (group ai-testers) asks one
// short question; requests without a token are refused. Each run uses one of the user's
// daily questions.

const email = process.env.SMOKE_USER_EMAIL;
const password = process.env.SMOKE_USER_PASSWORD;
const runtimeArn = process.env.SMOKE_ASSISTANT_ARN;

/** Invocation URL of the runtime, from its ARN (`arn:aws:bedrock-agentcore:<region>:…`). */
const invocationUrl = (arn: string) =>
  `https://bedrock-agentcore.${arn.split(':')[3] ?? ''}.amazonaws.com/runtimes/${encodeURIComponent(arn)}/invocations?qualifier=DEFAULT`;

/** Runtime sessions need an id of at least 33 characters. */
const sessionId = () => `smoke-${String(Date.now())}-${'x'.repeat(30)}`;

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

  test('answers the smoke user', async ({ page }) => {
    test.skip(!email || !password, 'SMOKE_USER_EMAIL and SMOKE_USER_PASSWORD are not set');
    test.setTimeout(90_000);
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

    const response = await page.request.post(invocationUrl(runtimeArn ?? ''), {
      headers: {
        Authorization: `Bearer ${idToken ?? ''}`,
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
});

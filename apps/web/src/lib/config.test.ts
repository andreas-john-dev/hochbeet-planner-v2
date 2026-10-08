import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config';

const ok = (body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

describe('loadConfig', () => {
  it('loads config.json and defaults to Cognito', async () => {
    const fetchFn = ok({
      region: 'eu-central-1',
      userPoolId: 'eu-central-1_a',
      userPoolClientId: 'b',
    });
    await expect(loadConfig(fetchFn)).resolves.toEqual({
      region: 'eu-central-1',
      userPoolId: 'eu-central-1_a',
      userPoolClientId: 'b',
      authMode: 'cognito',
      apiMode: 'live',
    });
    expect(fetchFn).toHaveBeenCalledWith('/config.json', { cache: 'no-store' });
  });

  it('rejects an incomplete config', async () => {
    await expect(loadConfig(ok({ region: 'eu-central-1' }))).rejects.toThrow();
  });

  it('fails on HTTP errors', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    // `rejects.toThrow(message)` reports an empty message in this jsdom setup; check the error itself.
    await expect(loadConfig(fetchFn)).rejects.toMatchObject({
      message: expect.stringContaining('HTTP 404') as unknown,
    });
  });
});

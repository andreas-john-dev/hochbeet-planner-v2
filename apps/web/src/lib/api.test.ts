import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiErrorMessage, createApiClient, shouldRetry } from './api';

describe('createApiClient', () => {
  it('sends the ID token and parses JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{"beds":[]}', { status: 200 }));
    const apiFetch = createApiClient(() => Promise.resolve('id-token'), fetchFn);

    await expect(apiFetch('/api/garden/beds')).resolves.toEqual({ beds: [] });
    const [path, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/garden/beds');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer id-token');
  });

  it('sets JSON content type for request bodies', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await createApiClient(() => Promise.resolve(null), fetchFn)('/api/garden/beds', {
      method: 'POST',
      body: '{}',
    });
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.has('Authorization')).toBe(false);
  });

  it('throws ApiError with status and body', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{"message":"nope"}', { status: 403 }));
    await expect(
      createApiClient(() => Promise.resolve('t'), fetchFn)('/api/catalog/plants'),
    ).rejects.toEqual(new ApiError(403, { message: 'nope' }));
  });

  it('keeps the status when an error page is not JSON', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));
    await expect(
      createApiClient(() => Promise.resolve('t'), fetchFn)('/api/catalog/plants'),
    ).rejects.toEqual(new ApiError(502, undefined));
  });
});

describe('apiErrorMessage', () => {
  it('prefers the German message of the service', () => {
    expect(apiErrorMessage(new ApiError(400, { message: 'Bitte prüfe deine Eingaben.' }))).toBe(
      'Bitte prüfe deine Eingaben.',
    );
  });

  it('explains the kind of failure otherwise', () => {
    expect(apiErrorMessage(new ApiError(401, undefined))).toMatch(/Anmeldung ist abgelaufen/);
    expect(apiErrorMessage(new ApiError(403, undefined))).toMatch(/Berechtigung/);
    expect(apiErrorMessage(new ApiError(404, undefined))).toMatch(/gibt es nicht mehr/);
    expect(apiErrorMessage(new ApiError(503, undefined))).toMatch(/Server hat gerade ein Problem/);
    expect(apiErrorMessage(new TypeError('Failed to fetch'))).toMatch(/Keine Verbindung/);
    expect(apiErrorMessage(new Error('?'))).toBe(
      'Das hat nicht geklappt. Bitte versuche es noch einmal.',
    );
  });
});

describe('shouldRetry', () => {
  it('does not retry client errors', () => {
    expect(shouldRetry(0, new ApiError(404, null))).toBe(false);
    expect(shouldRetry(0, new ApiError(403, null))).toBe(false);
  });

  it('retries server and network errors three times', () => {
    expect(shouldRetry(0, new ApiError(503, null))).toBe(true);
    expect(shouldRetry(2, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetry(3, new TypeError('Failed to fetch'))).toBe(false);
  });
});

import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { messageKey } from '@hochbeet/contracts';
import { error, errorText, handle, json, parseJson, route } from './router';

const request = (path: string, init?: RequestInit) =>
  new Request(new URL(path, 'http://localhost'), init);

describe('handle', () => {
  const routes = [
    route('GET', '/api/garden/beds/:bedId', ({ params }) => json(params)),
    route('PUT', '/api/garden/beds/:bedId', () => json({ put: true })),
    route('GET', '/api/fails', () => {
      throw new Error('boom');
    }),
    route('GET', '/api/full', () => {
      throw new DOMException('full', 'QuotaExceededError');
    }),
  ];

  it('matches method and path and decodes params', async () => {
    const response = await handle(routes, request('/api/garden/beds/a%20b/'));
    expect(await response.json()).toEqual({ bedId: 'a b' });
    const put = await handle(routes, request('/api/garden/beds/x', { method: 'PUT' }));
    expect(await put.json()).toEqual({ put: true });
  });

  it('answers 404 for unknown routes and methods', async () => {
    for (const r of [
      request('/api/garden/beds'),
      request('/api/garden/beds/x/plantings'),
      request('/api/garden/beds/x', { method: 'DELETE' }),
    ]) {
      const response = await handle(routes, r);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ message: 'Diese Adresse gibt es nicht.' });
    }
  });

  it('answers in the language of Accept-Language, like the services', async () => {
    const english = { headers: { 'Accept-Language': 'en-GB,en;q=0.9' } };
    const unknown = await handle(routes, request('/api/garden/beds', english));
    expect(await unknown.json()).toEqual({ message: 'This address does not exist.' });
    const failed = await handle(routes, request('/api/fails', english));
    expect(await failed.json()).toEqual({ message: 'That did not work. Please try again.' });
    const neighbors = [
      route('GET', '/api/n', () =>
        error('checkNeighbors', 400, [
          { path: 'badNeighbors.0', message: messageKey('neighborSelf') },
        ]),
      ),
      route('GET', '/api/fixed', () =>
        errorText('Für Pflanzvorschläge brauche ich ein Beet.', 400),
      ),
    ];
    expect(await (await handle(neighbors, request('/api/n', english))).json()).toEqual({
      message: 'Please check the neighbours.',
      issues: [{ path: 'badNeighbors.0', message: 'A plant cannot be its own neighbour.' }],
    });
    expect(await (await handle(neighbors, request('/api/n'))).json()).toEqual({
      message: 'Bitte prüfe die Nachbarn.',
      issues: [
        { path: 'badNeighbors.0', message: 'Eine Sorte kann nicht ihr eigener Nachbar sein.' },
      ],
    });
    // Fixed texts, e.g. those of the assistant, stay as they are.
    expect(await (await handle(neighbors, request('/api/fixed', english))).json()).toEqual({
      message: 'Für Pflanzvorschläge brauche ich ein Beet.',
    });
  });

  it('turns a full browser storage into 507 and other errors into 500', async () => {
    const full = await handle(routes, request('/api/full'));
    expect(full.status).toBe(507);
    expect(((await full.json()) as { message: string }).message).toMatch(/Speicher/);
    expect((await handle(routes, request('/api/fails'))).status).toBe(500);
  });
});

describe('parseJson', () => {
  const schema = z.object({ name: z.string().min(1) });
  const post = (body: string) => request('/api/x', { method: 'POST', body });

  it('returns the parsed body', async () => {
    expect(await parseJson(post('{"name":"Beet"}'), schema)).toEqual({ data: { name: 'Beet' } });
  });

  it('answers 400 with issues for invalid and non-JSON bodies', async () => {
    for (const raw of ['{"name":""}', 'kein json']) {
      const result = await parseJson(post(raw), schema);
      expect(result.response?.status).toBe(400);
      const body = (await result.response?.json()) as { message: string; issues: unknown[] };
      expect(body.message).toBe('Bitte prüfe deine Eingaben.');
      expect(body.issues).toHaveLength(1);
    }
  });

  it('names the issues in English, own messages and Zod defaults', async () => {
    const english = z.object({ name: z.string().max(3, messageKey('maxChars', { max: 3 })) });
    const result = await parseJson(
      request('/api/x', {
        method: 'POST',
        body: '{"name":"Hochbeet","extra":1}',
        headers: { 'Accept-Language': 'en' },
      }),
      english.strict(),
    );
    expect(await result.response?.json()).toEqual({
      message: 'Please check your entries.',
      issues: [
        { path: 'name', message: 'At most 3 characters.' },
        { path: '', message: expect.stringMatching(/^Unrecognized key/) as string },
      ],
    });
  });
});

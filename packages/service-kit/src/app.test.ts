import { BedFieldsSchema, type ErrorResponse, messageKey } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { createServiceApp, parseBody } from './app';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors';
import { createLogger } from './logger';
import { authorized } from './testing';

function testApp() {
  const app = createServiceApp(
    '/api/test',
    createLogger({}, () => undefined),
  );
  app.post('/beds', async (c) => c.json(await parseBody(c, BedFieldsSchema)));
  app.get('/missing', () => {
    throw new NotFoundError('bedNotFound');
  });
  app.get('/conflict', () => {
    throw new ConflictError('alreadyHandled');
  });
  app.get('/forbidden', () => {
    throw new ForbiddenError('adminOnly');
  });
  app.get('/neighbors', () => {
    throw new ValidationError('checkNeighbors', [
      { path: 'goodNeighbors.0', message: messageKey('neighborSelf') },
    ]);
  });
  app.get('/broken', () => {
    throw new Error('boom');
  });
  return app;
}

const call = async (path: string, language?: string, init: RequestInit = {}, signedIn = true) => {
  const headers = new Headers(init.headers);
  if (language) headers.set('Accept-Language', language);
  const response = await testApp().request(
    `/api/test${path}`,
    { ...init, headers },
    signedIn ? authorized('user-1') : undefined,
  );
  return { status: response.status, body: (await response.json()) as ErrorResponse };
};

const post = (body: string, language?: string) =>
  call('/beds', language, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });

describe('error responses', () => {
  it('answer in German without Accept-Language and in English with it', async () => {
    expect(await call('/missing')).toEqual({
      status: 404,
      body: { message: 'Dieses Beet gibt es nicht.' },
    });
    expect(await call('/missing', 'en-GB,en;q=0.9')).toEqual({
      status: 404,
      body: { message: 'This bed does not exist.' },
    });
    expect((await call('/missing', 'fr')).body.message).toBe('Dieses Beet gibt es nicht.');
  });

  it('name the kit errors in both languages', async () => {
    expect(await call('/nowhere', 'en')).toEqual({
      status: 404,
      body: { message: 'This address does not exist.' },
    });
    expect(await call('/missing', 'en', {}, false)).toEqual({
      status: 401,
      body: { message: 'Please sign in.' },
    });
    expect(await call('/missing', undefined, {}, false)).toEqual({
      status: 401,
      body: { message: 'Bitte melde dich an.' },
    });
    expect((await call('/conflict', 'en')).body.message).toBe(
      'This request has already been handled.',
    );
    expect((await call('/forbidden', 'en')).status).toBe(403);
    expect((await call('/forbidden')).body.message).toBe('Dieser Bereich ist nur für Admins.');
    expect(await call('/broken', 'en')).toEqual({
      status: 500,
      body: { message: 'Something went wrong. Please try again later.' },
    });
  });

  it('turn the keys of field issues into text', async () => {
    expect(await call('/neighbors', 'en')).toEqual({
      status: 400,
      body: {
        message: 'Please check the neighbours.',
        issues: [{ path: 'goodNeighbors.0', message: 'A plant cannot be its own neighbour.' }],
      },
    });
  });

  it('check bodies with own messages and Zod defaults in the caller’s language', async () => {
    const bed = JSON.stringify({
      name: '',
      widthCm: 200,
      depthCm: 100,
      mainRowDirection: 'X',
      soilRenewals: [],
    });
    expect(await post(bed)).toEqual({
      status: 400,
      body: {
        message: 'Bitte prüfe deine Eingaben.',
        issues: [
          { path: 'name', message: 'Bitte einen Namen angeben.' },
          {
            path: 'mainRowDirection',
            message: expect.stringMatching(/^Ungültige Option/) as string,
          },
        ],
      },
    });
    expect(await post(bed, 'en')).toEqual({
      status: 400,
      body: {
        message: 'Please check your entries.',
        issues: [
          { path: 'name', message: 'Please enter a name.' },
          { path: 'mainRowDirection', message: expect.stringMatching(/^Invalid option/) as string },
        ],
      },
    });
    expect(await post('{', 'en')).toEqual({
      status: 400,
      body: { message: 'The request is not valid JSON.' },
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import type { UserCatalogItems } from './catalog/repository';
import type { CatalogStore } from './catalog/service';
import { createLogger } from './logger';
import { authorized, seedPlant, USER_A } from './test/fixtures';

function setup(overrides: Partial<CatalogStore> = {}) {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({ service: 'catalog' }, (line) => {
    lines.push(JSON.parse(line) as Record<string, unknown>);
  });
  const repository = {
    listGlobalPlants: vi.fn(() => Promise.resolve([seedPlant('Tomate')])),
    listUserItems: vi.fn((): Promise<UserCatalogItems> =>
      Promise.resolve({ overrides: [], own: [] }),
    ),
    getGlobalPlant: vi.fn(() => Promise.resolve(undefined)),
    getOwnPlant: vi.fn(() => Promise.resolve(undefined)),
    createOwnPlant: vi.fn(() => Promise.resolve()),
    replaceOwnPlant: vi.fn(() => Promise.resolve(true)),
    archiveOwnPlant: vi.fn(() => Promise.resolve(true)),
    putOverride: vi.fn(() => Promise.resolve()),
    deleteOverride: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  return { app: createApp({ store: repository, logger }), repository, lines };
}

describe('catalog app', () => {
  it('answers 401 without verified token claims', async () => {
    const { app, repository } = setup();
    const response = await app.request('/api/catalog/plants');
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Bitte melde dich an.' });
    expect(repository.listUserItems).not.toHaveBeenCalled();
  });

  it('lists the effective plants of the signed-in user', async () => {
    const { app, repository } = setup();
    const response = await app.request('/api/catalog/plants', {}, authorized(USER_A));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { plants: { name: string; source: string }[] };
    expect(body.plants).toEqual([expect.objectContaining({ name: 'Tomate', source: 'GLOBAL' })]);
    expect(repository.listUserItems).toHaveBeenCalledWith(USER_A);
  });

  it('answers 404 with a German message for unknown routes', async () => {
    const { app } = setup();
    const response = await app.request('/api/catalog/unbekannt', {}, authorized(USER_A));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'Diese Adresse gibt es nicht.' });
  });

  it('hides internal errors and logs them', async () => {
    const { app, lines } = setup({
      listGlobalPlants: () => Promise.reject(new Error('table missing')),
    });
    const response = await app.request('/api/catalog/plants', {}, authorized(USER_A));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('table missing');
    expect(lines).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'unhandled error',
        userId: USER_A,
        error: expect.objectContaining({ message: 'table missing' }) as unknown,
      }),
    );
  });

  it('writes one structured log line per request', async () => {
    const { app, lines } = setup();
    await app.request('/api/catalog/plants', {}, authorized(USER_A));
    expect(lines).toEqual([
      expect.objectContaining({
        level: 'info',
        message: 'request',
        service: 'catalog',
        requestId: 'req-1',
        userId: USER_A,
        method: 'GET',
        path: '/api/catalog/plants',
        status: 200,
      }),
    ]);
  });
});

import type { GardenSettings } from '@hochbeet/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { visibleNavItems } from '@/components/layout/nav-items';
import type { ApiFetch } from './api';
import { ApiContext } from './api-context';
import { queryKeys } from './garden';
import { useView } from './view';

function setup(api: ApiFetch) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  );
  return { client, ...renderHook(() => useView(), { wrapper }) };
}

const saved: GardenSettings = { lastFrost: '04-20', view: 'SIMPLE' };

describe('useView', () => {
  it('switches at once and saves the view with the saved last frost', async () => {
    let finish: (settings: GardenSettings) => void = () => undefined;
    const api = vi.fn((_path: string, init?: RequestInit) =>
      init?.method === 'PUT'
        ? new Promise<GardenSettings>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(saved),
    );
    const { result, client } = setup(api as unknown as ApiFetch);
    await waitFor(() => {
      expect(result.current.view).toBe('SIMPLE');
    });

    act(() => {
      result.current.setView('EXPERT');
    });
    // Optimistic: the view changes before the service answers.
    await waitFor(() => {
      expect(result.current.view).toBe('EXPERT');
    });
    expect(api).toHaveBeenLastCalledWith('/api/garden/settings', {
      method: 'PUT',
      body: JSON.stringify({ lastFrost: '04-20', view: 'EXPERT' }),
    });
    act(() => {
      finish({ lastFrost: '04-20', view: 'EXPERT' });
    });
    await waitFor(() => {
      expect(client.getQueryData(queryKeys.settings)).toEqual({
        lastFrost: '04-20',
        view: 'EXPERT',
      });
    });
  });

  it('goes back to the saved view when saving fails', async () => {
    const api = vi.fn((_path: string, init?: RequestInit) =>
      init?.method === 'PUT' ? Promise.reject(new Error('offline')) : Promise.resolve(saved),
    );
    const { result } = setup(api as unknown as ApiFetch);
    await waitFor(() => {
      expect(result.current.view).toBe('SIMPLE');
    });
    act(() => {
      result.current.setView('EXPERT');
    });
    await waitFor(() => {
      expect(result.current.saveError).not.toBeNull();
    });
    expect(result.current.view).toBe('SIMPLE');
  });
});

describe('visibleNavItems', () => {
  const targets = (...args: Parameters<typeof visibleNavItems>) =>
    visibleNavItems(...args).map((item) => item.to);

  it('hides the seedlings in the simple view only', () => {
    expect(targets({ admin: false, guest: false, view: 'SIMPLE' })).toEqual([
      '/beete',
      '/katalog',
      '/profil',
    ]);
    expect(targets({ admin: false, guest: false, view: 'EXPERT' })).toContain('/anzucht');
    // While the settings load, nothing disappears that might stay.
    expect(targets({ admin: false, guest: false, view: undefined })).toContain('/anzucht');
  });

  it('keeps hiding admin and account pages', () => {
    expect(targets({ admin: true, guest: false, view: 'EXPERT' })).toContain('/admin');
    expect(targets({ admin: false, guest: true, view: 'SIMPLE' })).toEqual(['/beete', '/katalog']);
  });
});

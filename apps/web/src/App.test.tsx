import { createMemoryHistory } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { GUEST_MODE_KEY } from './lib/auth/guest';
import { createMockAuthAdapter, MOCK_USERS } from './lib/auth/mock-adapter';
import { GUEST_STORAGE_KEY } from './lib/local-api/keys';
import { createMockFetch } from './mocks/fetch';

type Account = keyof typeof MOCK_USERS;

async function renderAt(path: string, account?: Account) {
  const auth = createMockAuthAdapter();
  if (account) await auth.signIn(MOCK_USERS[account].email, MOCK_USERS[account].password);
  return render(<App auth={auth} history={createMemoryHistory({ initialEntries: [path] })} />);
}

/** The sidebar navigation; the bottom navigation for phones is the second one. */
async function sidebarNav() {
  const [sidebar] = await screen.findAllByRole('navigation', { name: 'Hauptnavigation' });
  if (!sidebar) throw new Error('Navigation missing');
  return within(sidebar);
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('signed out', () => {
    it.each(['/', '/beete', '/katalog', '/profil', '/admin'])(
      'redirects %s to the sign-in page',
      async (path) => {
        await renderAt(path);
        expect(await heading('Anmelden')).toBeVisible();
      },
    );

    it('signs in and returns to the page that was requested', async () => {
      await renderAt('/katalog');
      await userEvent.type(await screen.findByLabelText('E-Mail'), MOCK_USERS.user.email);
      await userEvent.type(screen.getByLabelText('Passwort'), MOCK_USERS.user.password);
      await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
      expect(await heading('Pflanzenkatalog')).toBeVisible();
    });

    it('shows a German error for wrong credentials', async () => {
      await renderAt('/anmelden');
      await userEvent.type(await screen.findByLabelText('E-Mail'), MOCK_USERS.user.email);
      await userEvent.type(screen.getByLabelText('Passwort'), 'falsch');
      await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'E-Mail oder Passwort ist falsch.',
      );
    });

    it('validates the form before calling Cognito', async () => {
      await renderAt('/anmelden');
      await userEvent.click(await screen.findByRole('button', { name: 'Anmelden' }));
      expect(await screen.findByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeVisible();
    });
  });

  describe('signed in as user', () => {
    it('opens the beds page and hides the admin section', async () => {
      await renderAt('/', 'user');
      expect(await heading('Meine Beete')).toBeVisible();
      const links = (await sidebarNav()).getAllByRole('link');
      expect(links.map((l) => l.textContent)).toEqual(['Beete', 'Katalog', 'Profil']);
    });

    it('gets a 403 page for the admin area', async () => {
      await renderAt('/admin', 'user');
      expect(await heading('Kein Zugriff')).toBeVisible();
      expect(screen.getByText(/Fehler 403/)).toBeVisible();
    });

    it('leaves the sign-in page for the app', async () => {
      await renderAt('/anmelden', 'user');
      expect(await heading('Meine Beete')).toBeVisible();
    });

    it('signs out', async () => {
      await renderAt('/beete', 'user');
      const [signOut] = await screen.findAllByRole('button', { name: 'Abmelden' });
      if (!signOut) throw new Error('Sign-out button missing');
      await userEvent.click(signOut);
      expect(await heading('Anmelden')).toBeVisible();
    });

    it('switches to dark mode from the profile page', async () => {
      await renderAt('/profil', 'user');
      await userEvent.click(await screen.findByRole('button', { name: 'Dunkel' }));
      expect(document.documentElement).toHaveClass('dark');
    });
  });

  describe('signed in as admin', () => {
    it('shows and opens the admin section', async () => {
      await renderAt('/beete', 'admin');
      await userEvent.click((await sidebarNav()).getByRole('link', { name: 'Admin' }));
      expect(await heading('Administration')).toBeVisible();
    });
  });

  describe('guest mode', () => {
    /** The app with the mock API, recording every request that leaves the local API. */
    function renderGuest(path: string) {
      const mockFetch = createMockFetch();
      const fetchFn = vi.fn<typeof fetch>((input, init) => mockFetch(input, init));
      render(
        <App
          auth={createMockAuthAdapter()}
          fetchFn={fetchFn}
          history={createMemoryHistory({ initialEntries: [path] })}
        />,
      );
      const paths = () =>
        fetchFn.mock.calls.map(([input]) =>
          typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url,
        );
      return { paths };
    }

    /** Guest mode with one bed in this browser's storage. */
    const seedGuestBed = (name: string) => {
      localStorage.setItem(GUEST_MODE_KEY, '1');
      const bed = {
        id: '01J9ZQ3W8D6V2K5M7N8P9R0BED',
        name,
        widthCm: 100,
        depthCm: 50,
        mainRowDirection: 'V',
        soilRenewals: [],
      };
      localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({ version: 1, garden: { beds: [bed], plantings: [] } }),
      );
    };

    const startGuest = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Ohne Konto ausprobieren' }));
      expect(await heading('Meine Beete')).toBeVisible();
    };

    it('starts from the sign-in page without any request to the services', async () => {
      const { paths } = renderGuest('/anmelden');
      await startGuest();
      expect(screen.getByTestId('guest-banner')).toHaveTextContent('nur in diesem Browser');
      const links = (await sidebarNav()).getAllByRole('link');
      expect(links.map((l) => l.textContent)).toEqual(['Beete', 'Katalog']);
      expect(await screen.findByRole('button', { name: 'Erstes Beet anlegen' })).toBeVisible();
      expect(localStorage.getItem(GUEST_MODE_KEY)).toBe('1');
      expect(paths()).toEqual([]);
    });

    it('shows the beds from this browser after a reload', async () => {
      seedGuestBed('Balkon');
      renderGuest('/beete');
      expect(await screen.findByText('Balkon')).toBeVisible();
      expect(screen.getByTestId('guest-banner')).toBeVisible();
    });

    it('loads only the public catalogue from the server', async () => {
      localStorage.setItem(GUEST_MODE_KEY, '1');
      const { paths } = renderGuest('/katalog');
      expect(await heading('Pflanzenkatalog')).toBeVisible();
      expect(await screen.findByText('Kopfsalat')).toBeVisible();
      expect(paths()).toEqual(['/api/catalog/public/plants']);
    });

    it.each(['/profil', '/admin'])('sends guests from %s to the sign-in page', async (path) => {
      localStorage.setItem(GUEST_MODE_KEY, '1');
      renderGuest(path);
      expect(await heading('Anmelden')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Weiter ohne Konto' })).toBeVisible();
    });

    it.each([
      ['Daten behalten', true],
      ['Daten löschen', false],
    ] as const)('ends guest mode with „%s“', async (choice, kept) => {
      localStorage.setItem(GUEST_MODE_KEY, '1');
      localStorage.setItem(GUEST_STORAGE_KEY, '{"version":1,"garden":{"beds":[]}}');
      renderGuest('/beete');
      await userEvent.click(await screen.findByRole('button', { name: 'Gastmodus beenden' }));
      await userEvent.click(screen.getByRole('button', { name: choice }));
      expect(await heading('Anmelden')).toBeVisible();
      expect(localStorage.getItem(GUEST_MODE_KEY)).toBeNull();
      expect(localStorage.getItem(GUEST_STORAGE_KEY) !== null).toBe(kept);
    });

    it('ends when signing in, and the user does not see cached guest data', async () => {
      seedGuestBed('Gastbeet');
      const { paths } = renderGuest('/beete');
      expect(await screen.findByText('Gastbeet')).toBeVisible();

      const [signIn] = screen.getAllByRole('link', { name: 'Anmelden' });
      if (!signIn) throw new Error('Sign-in link missing');
      await userEvent.click(signIn);
      await userEvent.type(await screen.findByLabelText('E-Mail'), MOCK_USERS.user.email);
      await userEvent.type(screen.getByLabelText('Passwort'), MOCK_USERS.user.password);
      await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
      expect(await heading('Meine Beete')).toBeVisible();
      expect(await screen.findByRole('button', { name: 'Erstes Beet anlegen' })).toBeVisible();
      expect(screen.queryByText('Gastbeet')).toBeNull();
      expect(screen.queryByTestId('guest-banner')).toBeNull();
      expect(localStorage.getItem(GUEST_MODE_KEY)).toBeNull();
      // The guest's data stays for the import after sign-in (T-39).
      expect(localStorage.getItem(GUEST_STORAGE_KEY)).toContain('Gastbeet');
      expect(paths()).toContain('/api/garden/beds');
    });
  });

  it('shows a German not-found page', async () => {
    await renderAt('/gibt-es-nicht');
    expect(await screen.findByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
  });
});

import { createMemoryHistory } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { createMockAuthAdapter, MOCK_USERS } from './lib/auth/mock-adapter';

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

    it('cannot open the admin page', async () => {
      await renderAt('/admin', 'user');
      expect(await heading('Meine Beete')).toBeVisible();
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

  it('shows a German not-found page', async () => {
    await renderAt('/gibt-es-nicht');
    expect(await screen.findByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
  });
});

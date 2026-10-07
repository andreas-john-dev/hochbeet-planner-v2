import { createMemoryHistory } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function renderAt(path: string) {
  return render(<App history={createMemoryHistory({ initialEntries: [path] })} />);
}

/** The sidebar navigation; the bottom navigation for phones is the second one. */
async function sidebarNav() {
  const [sidebar] = await screen.findAllByRole('navigation', { name: 'Hauptnavigation' });
  if (!sidebar) throw new Error('Navigation missing');
  return within(sidebar);
}

describe('App shell', () => {
  it('redirects the start page to the beds page', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Meine Beete' })).toBeVisible();
  });

  it('offers all four sections in the navigation', async () => {
    renderAt('/beete');
    const links = (await sidebarNav()).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Beete', 'Katalog', 'Profil', 'Admin']);
  });

  it('navigates to the catalog', async () => {
    renderAt('/beete');
    await userEvent.click((await sidebarNav()).getByRole('link', { name: 'Katalog' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pflanzenkatalog' })).toBeVisible();
  });

  it('shows a German not-found page', async () => {
    renderAt('/gibt-es-nicht');
    expect(await screen.findByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
  });

  it('switches to dark mode from the profile page', async () => {
    renderAt('/profil');
    await userEvent.click(await screen.findByRole('button', { name: 'Dunkel' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Dunkel' })).toHaveAttribute('aria-pressed', 'true');
  });
});

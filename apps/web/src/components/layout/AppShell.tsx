import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';
import { isAdmin } from '@/lib/auth/types';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { navItems } from './nav-items';
import { ThemeToggle } from './ThemeToggle';

/** Sidebar on desktop, top bar and bottom navigation on phones. */
export function AppShell() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = navItems.filter((item) => !item.adminOnly || isAdmin(user));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside
        data-screenshot="sidebar"
        className="bg-sidebar sticky top-0 hidden h-dvh flex-col border-r p-4 md:flex"
      >
        <Link to="/beete" className="rounded-md px-2 py-2">
          <Logo />
        </Link>
        <nav aria-label="Hauptnavigation" className="mt-8 flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'text-muted-foreground flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground',
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t pt-3">
          <p className="text-muted-foreground truncate px-3 pb-1 text-xs" title={user?.email}>
            {user?.email}
          </p>
          <ThemeToggle showLabel />
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="bg-background/90 sticky top-0 z-10 flex h-14 items-center justify-between border-b px-4 backdrop-blur md:hidden">
          <Link to="/beete">
            <Logo />
          </Link>
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:px-10 md:pt-10 md:pb-10">
          {/* Keyed by path: each page enters softly (not with reduced motion). */}
          <div key={pathname} className="animate-enter">
            <Outlet />
          </div>
        </main>
      </div>

      <nav
        aria-label="Hauptnavigation"
        data-screenshot="bottom-nav"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-10 grid auto-cols-fr grid-flow-col border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="text-muted-foreground data-[status=active]:text-primary flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium"
          >
            <Icon className="size-[22px]" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function SignOutButton({ variant = 'sidebar' }: { variant?: 'sidebar' | 'card' }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <Button
      variant={variant === 'sidebar' ? 'ghost' : 'outline'}
      className={variant === 'sidebar' ? 'w-full justify-start' : 'w-fit'}
      onClick={() => {
        void signOut().then(() => navigate({ to: '/anmelden' }));
      }}
    >
      <LogOut aria-hidden />
      Abmelden
    </Button>
  );
}

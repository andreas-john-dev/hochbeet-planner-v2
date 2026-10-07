import { Link, Outlet } from '@tanstack/react-router';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

/** Centered card layout for sign-in, sign-up and password reset. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between px-4 md:px-8">
        <Link to="/anmelden">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-12 md:items-center md:pt-0">
        <div className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-xs md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

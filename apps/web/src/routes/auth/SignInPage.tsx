import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FormField, FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';
import { authErrorCode, authErrorMessage } from '@/lib/auth/errors';
import { safeRedirect } from '@/lib/auth/redirect';
import { signInSchema } from '@/lib/auth/schemas';
import { AuthHeading } from './AuthLayout';
import { parseSignInSearch } from './search';

const notices = {
  bestaetigt: 'Dein Konto ist bestätigt. Du kannst dich jetzt anmelden.',
  passwort: 'Dein Passwort wurde geändert. Melde dich mit dem neuen Passwort an.',
} as const;

export function SignInPage() {
  const { redirect, hinweis, email } = parseSignInSearch(useSearch({ strict: false }));
  const { adapter, refresh } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: email ?? '', password: '' },
  });

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(undefined);
    try {
      const result = await adapter.signIn(email, password);
      if (result === 'CONFIRM_SIGN_UP') {
        await adapter.resendSignUpCode(email);
        await navigate({ to: '/registrieren', search: { email, schritt: 'bestaetigen' } });
        return;
      }
      await refresh();
      await router.navigate({ href: safeRedirect(redirect) });
    } catch (e) {
      if (authErrorCode(e) === 'UserNotConfirmedException') {
        await navigate({ to: '/registrieren', search: { email, schritt: 'bestaetigen' } });
        return;
      }
      setError(authErrorMessage(e));
    }
  });

  return (
    <>
      <AuthHeading title="Anmelden" description="Willkommen zurück im Hochbeet-Planer." />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        {hinweis && <FormMessage tone="success">{notices[hinweis]}</FormMessage>}
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <FormField
          label="E-Mail"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <FormField
          label="Passwort"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <Link
          to="/passwort-vergessen"
          className="text-primary -mt-1 self-end text-sm font-medium hover:underline"
        >
          Passwort vergessen?
        </Link>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Anmelden …' : 'Anmelden'}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Noch kein Konto?{' '}
        <Link to="/registrieren" className="text-primary font-medium hover:underline">
          Registrieren
        </Link>
      </p>
    </>
  );
}

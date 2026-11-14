import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormField, FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';
import { authErrorCode, authErrorMessage } from '@/lib/auth/errors';
import { safeRedirect } from '@/lib/auth/redirect';
import { signInSchema } from '@/lib/auth/schemas';
import { AuthHeading } from './AuthLayout';
import { TryWithoutAccount } from './TryWithoutAccount';
import { parseSignInSearch } from './search';

const notices = { bestaetigt: 'signIn.confirmed', passwort: 'signIn.passwordChanged' } as const;

export function SignInPage() {
  const { redirect, hinweis, email } = parseSignInSearch(useSearch({ strict: false }));
  const { t } = useTranslation('auth');
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
      <AuthHeading title={t('signIn.title')} description={t('signIn.description')} />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        {hinweis && <FormMessage tone="success">{t(notices[hinweis])}</FormMessage>}
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <FormField
          label={t('fields.email')}
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <FormField
          label={t('fields.password')}
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <Link
          to="/passwort-vergessen"
          className="text-primary -mt-1 self-end text-sm font-medium hover:underline"
        >
          {t('signIn.forgotPassword')}
        </Link>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('signIn.submitting') : t('signIn.submit')}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        {t('signIn.noAccount')}{' '}
        <Link to="/registrieren" className="text-primary font-medium hover:underline">
          {t('signIn.signUp')}
        </Link>
      </p>
      <TryWithoutAccount />
    </>
  );
}

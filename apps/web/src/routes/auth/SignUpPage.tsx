import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormField, FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';
import { authErrorMessage } from '@/lib/auth/errors';
import { confirmSchema, signUpSchema } from '@/lib/auth/schemas';
import { AuthHeading } from './AuthLayout';
import { TryWithoutAccount } from './TryWithoutAccount';
import { parseSignUpSearch } from './search';

export function SignUpPage() {
  const { schritt, email } = parseSignUpSearch(useSearch({ strict: false }));
  return schritt === 'bestaetigen' && email ? <ConfirmSignUp email={email} /> : <SignUpForm />;
}

function SignUpForm() {
  const { t } = useTranslation('auth');
  const { adapter } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', passwordRepeat: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(undefined);
    try {
      await adapter.signUp(email, password);
      await navigate({ to: '/registrieren', search: { email, schritt: 'bestaetigen' } });
    } catch (e) {
      setError(authErrorMessage(e));
    }
  });

  return (
    <>
      <AuthHeading title={t('signUp.title')} description={t('signUp.description')} />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <FormField
          label={t('fields.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <FormField
          label={t('fields.password')}
          type="password"
          autoComplete="new-password"
          hint={t('passwordHint')}
          error={errors.password?.message}
          {...form.register('password')}
        />
        <FormField
          label={t('fields.passwordRepeat')}
          type="password"
          autoComplete="new-password"
          error={errors.passwordRepeat?.message}
          {...form.register('passwordRepeat')}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('signUp.submitting') : t('signUp.submit')}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        {t('signUp.haveAccount')}{' '}
        <Link to="/anmelden" className="text-primary font-medium hover:underline">
          {t('signUp.signIn')}
        </Link>
      </p>
      <TryWithoutAccount />
    </>
  );
}

function ConfirmSignUp({ email }: { email: string }) {
  const { t } = useTranslation('auth');
  const { adapter } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const form = useForm<z.infer<typeof confirmSchema>>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = form.handleSubmit(async ({ code }) => {
    setError(undefined);
    try {
      await adapter.confirmSignUp(email, code);
      await navigate({ to: '/anmelden', search: { hinweis: 'bestaetigt', email } });
    } catch (e) {
      setError(authErrorMessage(e));
    }
  });

  const resend = async () => {
    setError(undefined);
    try {
      await adapter.resendSignUpCode(email);
      setNotice(t('confirm.resent'));
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  return (
    <>
      <AuthHeading title={t('confirm.title')} description={t('confirm.description', { email })} />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {notice && <FormMessage tone="success">{notice}</FormMessage>}
        <FormField
          label={t('fields.confirmationCode')}
          inputMode="numeric"
          autoComplete="one-time-code"
          error={form.formState.errors.code?.message}
          {...form.register('code')}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {t('confirm.submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void resend()}>
          {t('confirm.resend')}
        </Button>
      </form>
    </>
  );
}

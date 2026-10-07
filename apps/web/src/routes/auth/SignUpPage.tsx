import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FormField, FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';
import { authErrorMessage } from '@/lib/auth/errors';
import { confirmSchema, PASSWORD_HINT, signUpSchema } from '@/lib/auth/schemas';
import { AuthHeading } from './AuthLayout';
import { parseSignUpSearch } from './search';

export function SignUpPage() {
  const { schritt, email } = parseSignUpSearch(useSearch({ strict: false }));
  return schritt === 'bestaetigen' && email ? <ConfirmSignUp email={email} /> : <SignUpForm />;
}

function SignUpForm() {
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
      <AuthHeading
        title="Registrieren"
        description="Lege ein Konto an, um deine Beete zu planen."
      />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <FormField
          label="E-Mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <FormField
          label="Passwort"
          type="password"
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          error={errors.password?.message}
          {...form.register('password')}
        />
        <FormField
          label="Passwort wiederholen"
          type="password"
          autoComplete="new-password"
          error={errors.passwordRepeat?.message}
          {...form.register('passwordRepeat')}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Registrieren …' : 'Registrieren'}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Schon ein Konto?{' '}
        <Link to="/anmelden" className="text-primary font-medium hover:underline">
          Anmelden
        </Link>
      </p>
    </>
  );
}

function ConfirmSignUp({ email }: { email: string }) {
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
      setNotice('Wir haben dir einen neuen Code geschickt.');
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  return (
    <>
      <AuthHeading
        title="E-Mail bestätigen"
        description={`Wir haben einen 6-stelligen Code an ${email} geschickt.`}
      />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {notice && <FormMessage tone="success">{notice}</FormMessage>}
        <FormField
          label="Bestätigungscode"
          inputMode="numeric"
          autoComplete="one-time-code"
          error={form.formState.errors.code?.message}
          {...form.register('code')}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Bestätigen
        </Button>
        <Button type="button" variant="ghost" onClick={() => void resend()}>
          Code erneut senden
        </Button>
      </form>
    </>
  );
}

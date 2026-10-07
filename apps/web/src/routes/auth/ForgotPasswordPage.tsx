import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FormField, FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';
import { authErrorMessage } from '@/lib/auth/errors';
import { PASSWORD_HINT, resetConfirmSchema, resetRequestSchema } from '@/lib/auth/schemas';
import { AuthHeading } from './AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState<string>();
  return email ? <ResetPassword email={email} /> : <RequestCode onSent={setEmail} />;
}

function RequestCode({ onSent }: { onSent: (email: string) => void }) {
  const { adapter } = useAuth();
  const [error, setError] = useState<string>();
  const form = useForm<z.infer<typeof resetRequestSchema>>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(undefined);
    try {
      await adapter.resetPassword(email);
      onSent(email);
    } catch (e) {
      setError(authErrorMessage(e));
    }
  });

  return (
    <>
      <AuthHeading
        title="Passwort vergessen"
        description="Wir schicken dir einen Code, mit dem du ein neues Passwort setzt."
      />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <FormField
          label="E-Mail"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Code senden
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        <Link to="/anmelden" className="text-primary font-medium hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </>
  );
}

function ResetPassword({ email }: { email: string }) {
  const { adapter } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const form = useForm<z.infer<typeof resetConfirmSchema>>({
    resolver: zodResolver(resetConfirmSchema),
    defaultValues: { code: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ code, password }) => {
    setError(undefined);
    try {
      await adapter.confirmResetPassword(email, code, password);
      await navigate({ to: '/anmelden', search: { hinweis: 'passwort', email } });
    } catch (e) {
      setError(authErrorMessage(e));
    }
  });

  return (
    <>
      <AuthHeading
        title="Neues Passwort"
        description={`Gib den Code ein, den wir an ${email} geschickt haben.`}
      />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <FormField
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          error={errors.code?.message}
          {...form.register('code')}
        />
        <FormField
          label="Neues Passwort"
          type="password"
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          error={errors.password?.message}
          {...form.register('password')}
        />
        <Button type="submit" disabled={isSubmitting}>
          Passwort speichern
        </Button>
      </form>
    </>
  );
}

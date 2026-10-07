import { z } from 'zod';

export const emailSchema = z.email('Bitte gib eine gültige E-Mail-Adresse ein.');

/** Mirrors the Cognito password policy in infra (SharedStatefulStack). */
export const newPasswordSchema = z
  .string()
  .min(8, 'Mindestens 8 Zeichen.')
  .regex(/[a-z]/, 'Mindestens ein Kleinbuchstabe.')
  .regex(/[A-Z]/, 'Mindestens ein Großbuchstabe.')
  .regex(/\d/, 'Mindestens eine Ziffer.')
  .regex(/[^A-Za-z0-9]/, 'Mindestens ein Sonderzeichen.');

export const PASSWORD_HINT =
  'Mindestens 8 Zeichen mit Groß- und Kleinbuchstaben, Ziffer und Sonderzeichen.';

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Der Code hat 6 Ziffern.');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Bitte gib dein Passwort ein.'),
});

export const signUpSchema = z
  .object({ email: emailSchema, password: newPasswordSchema, passwordRepeat: z.string() })
  .refine((v) => v.password === v.passwordRepeat, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwordRepeat'],
  });

export const confirmSchema = z.object({ code: codeSchema });

export const resetRequestSchema = z.object({ email: emailSchema });

export const resetConfirmSchema = z.object({ code: codeSchema, password: newPasswordSchema });

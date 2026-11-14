import { z } from 'zod';
import { i18n } from '@/lib/i18n';
import type { auth } from '@/locales/de/auth';

/** Message in the current language, resolved when a value is checked (not at import). */
const msg = (key: keyof typeof auth.validation) => ({
  error: () => i18n.t(`auth:validation.${key}`),
});

export const emailSchema = z.email(msg('email'));

/** Mirrors the Cognito password policy in infra (SharedStatefulStack). */
export const newPasswordSchema = z
  .string()
  .min(8, msg('passwordLength'))
  .regex(/[a-z]/, msg('passwordLowercase'))
  .regex(/[A-Z]/, msg('passwordUppercase'))
  .regex(/\d/, msg('passwordDigit'))
  .regex(/[^A-Za-z0-9]/, msg('passwordSpecial'));

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, msg('code'));

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, msg('passwordRequired')),
});

export const signUpSchema = z
  .object({ email: emailSchema, password: newPasswordSchema, passwordRepeat: z.string() })
  .refine((v) => v.password === v.passwordRepeat, {
    ...msg('passwordsDiffer'),
    path: ['passwordRepeat'],
  });

export const confirmSchema = z.object({ code: codeSchema });

export const resetRequestSchema = z.object({ email: emailSchema });

export const resetConfirmSchema = z.object({ code: codeSchema, password: newPasswordSchema });

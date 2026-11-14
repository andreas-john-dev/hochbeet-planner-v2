import { describe, expect, it } from 'vitest';
import { i18n } from '@/lib/i18n';
import { newPasswordSchema, signInSchema, signUpSchema } from './schemas';

describe('auth schemas', () => {
  it('accepts a password that Cognito accepts', () => {
    expect(newPasswordSchema.safeParse('Gemuese1!').success).toBe(true);
  });

  it.each(['kurz1!A', 'ohnegross1!', 'OHNEKLEIN1!', 'OhneZiffer!', 'OhneSonder1'])(
    'rejects %s',
    (password) => {
      expect(newPasswordSchema.safeParse(password).success).toBe(false);
    },
  );

  it('requires both passwords to match', () => {
    const result = signUpSchema.safeParse({
      email: 'a@example.com',
      password: 'Gemuese1!',
      passwordRepeat: 'Gemuese2!',
    });
    expect(result.error?.issues[0]?.message).toBe('Die Passwörter stimmen nicht überein.');
  });

  it('words its messages in the language of the app at the time of the check', async () => {
    await i18n.changeLanguage('en');
    const result = signInSchema.safeParse({ email: 'kein-mail', password: '' });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Please enter a valid email address.',
      'Please enter your password.',
    ]);
  });
});

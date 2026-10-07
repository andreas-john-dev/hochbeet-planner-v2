import { describe, expect, it } from 'vitest';
import { newPasswordSchema, signUpSchema } from './schemas';

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
});

import { describe, expect, it } from 'vitest';
import { i18n } from '@/lib/i18n';
import { AuthFailure, authErrorMessage } from './errors';

describe('authErrorMessage', () => {
  it('translates Cognito errors into German', () => {
    expect(authErrorMessage(new AuthFailure('CodeMismatchException'))).toBe(
      'Der Code ist nicht richtig.',
    );
  });

  it('does not reveal whether an account exists', () => {
    expect(authErrorMessage(new AuthFailure('UserNotFoundException'))).toBe(
      authErrorMessage(new AuthFailure('NotAuthorizedException')),
    );
  });

  it('falls back to a generic message', () => {
    expect(authErrorMessage(new Error('boom'))).toBe(
      'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    );
  });

  it('uses the language of the app', async () => {
    await i18n.changeLanguage('en');
    expect(authErrorMessage(new AuthFailure('CodeMismatchException'))).toBe(
      'The code is not correct.',
    );
  });
});

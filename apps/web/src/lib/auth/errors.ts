import { i18n } from '@/lib/i18n';
import type { auth } from '@/locales/de/auth';

/** Error thrown by auth adapters; `code` is the Cognito exception name. */
export class AuthFailure extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AuthFailure';
  }
}

type ErrorKey = keyof typeof auth.errors;

const keys: Record<string, ErrorKey> = {
  // Same text for both, so the form does not reveal whether an account exists.
  NotAuthorizedException: 'wrongCredentials',
  UserNotFoundException: 'wrongCredentials',
  UserNotConfirmedException: 'notConfirmed',
  UsernameExistsException: 'accountExists',
  CodeMismatchException: 'codeMismatch',
  ExpiredCodeException: 'codeExpired',
  InvalidPasswordException: 'invalidPassword',
  InvalidParameterException: 'invalidInput',
  LimitExceededException: 'tooManyAttempts',
  TooManyRequestsException: 'tooManyAttempts',
  NetworkError: 'network',
};

/** User-facing message in the app's language for any error of sign-in, sign-up or reset. */
export function authErrorMessage(error: unknown): string {
  const code = error instanceof AuthFailure ? error.code : error instanceof Error ? error.name : '';
  return i18n.t(`auth:errors.${keys[code] ?? 'generic'}`);
}

export function authErrorCode(error: unknown): string | undefined {
  return error instanceof AuthFailure ? error.code : undefined;
}

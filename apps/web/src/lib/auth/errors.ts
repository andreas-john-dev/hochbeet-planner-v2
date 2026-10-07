/** Error thrown by auth adapters; `code` is the Cognito exception name. */
export class AuthFailure extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AuthFailure';
  }
}

const messages: Record<string, string> = {
  // Same text for both, so the form does not reveal whether an account exists.
  NotAuthorizedException: 'E-Mail oder Passwort ist falsch.',
  UserNotFoundException: 'E-Mail oder Passwort ist falsch.',
  UserNotConfirmedException: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
  UsernameExistsException: 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
  CodeMismatchException: 'Der Code ist nicht richtig.',
  ExpiredCodeException: 'Der Code ist abgelaufen. Fordere einen neuen an.',
  InvalidPasswordException: 'Das Passwort erfüllt die Anforderungen nicht.',
  InvalidParameterException: 'Bitte prüfe deine Eingaben.',
  LimitExceededException: 'Zu viele Versuche. Bitte warte einen Moment.',
  TooManyRequestsException: 'Zu viele Versuche. Bitte warte einen Moment.',
  NetworkError: 'Keine Verbindung. Bitte prüfe deine Internetverbindung.',
};

/** German, user-facing message for any error thrown during sign-in, sign-up or password reset. */
export function authErrorMessage(error: unknown): string {
  const code = error instanceof AuthFailure ? error.code : error instanceof Error ? error.name : '';
  return messages[code] ?? 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
}

export function authErrorCode(error: unknown): string | undefined {
  return error instanceof AuthFailure ? error.code : undefined;
}

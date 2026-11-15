/**
 * Email with the code for sign-up and for a forgotten password: Cognito uses the same code
 * template for both (verification message, style CODE), so one text in German and English
 * covers them without a CustomMessage trigger. `{####}` is the code; Cognito renders HTML.
 */
export const VERIFICATION_EMAIL = {
  subject: 'Dein Code für den Hochbeet-Planer / Your Hochbeet-Planer code',
  body: [
    '<p>Dein Code für den Hochbeet-Planer: <strong>{####}</strong></p>',
    '<p>Gib ihn in der App ein, um deine E-Mail-Adresse zu bestätigen oder ein neues Passwort festzulegen.</p>',
    '<hr>',
    '<p>Your Hochbeet-Planer code is shown above.</p>',
    '<p>Enter it in the app to confirm your email address or to set a new password.</p>',
  ].join('\n'),
} as const;

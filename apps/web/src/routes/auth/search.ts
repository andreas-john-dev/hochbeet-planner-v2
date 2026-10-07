/** Search params of the auth pages; shared by router (validateSearch) and pages. */
const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  allowed.find((option) => option === value);
const record = (search: unknown): Record<string, unknown> =>
  typeof search === 'object' && search !== null ? (search as Record<string, unknown>) : {};

export interface SignInSearch {
  redirect?: string | undefined;
  email?: string | undefined;
  hinweis?: 'bestaetigt' | 'passwort' | undefined;
}

export function parseSignInSearch(search: unknown): SignInSearch {
  const s = record(search);
  return {
    redirect: str(s.redirect),
    email: str(s.email),
    hinweis: oneOf(s.hinweis, ['bestaetigt', 'passwort'] as const),
  };
}

export interface SignUpSearch {
  email?: string | undefined;
  schritt?: 'bestaetigen' | undefined;
}

export function parseSignUpSearch(search: unknown): SignUpSearch {
  const s = record(search);
  return { email: str(s.email), schritt: oneOf(s.schritt, ['bestaetigen'] as const) };
}

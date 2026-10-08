/** The part of the HTTP API (payload 2.0) event the service reads. */
export interface ApiEvent {
  requestContext: {
    requestId?: string;
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
}

export interface User {
  /** Cognito `sub`; the only source of the user id. */
  id: string;
  groups: string[];
}

/** `cognito:groups` arrives as an array or, from HTTP APIs, as a string like `[admins other]`. */
export function parseGroups(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  return value
    .replace(/^\[|\]$/g, '')
    .split(/[\s,]+/)
    .filter(Boolean);
}

/** User from the claims that the HTTP API JWT authorizer verified. */
export function userFromEvent(event: ApiEvent | undefined): User | undefined {
  const claims = event?.requestContext.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (typeof sub !== 'string' || sub === '') return undefined;
  return { id: sub, groups: parseGroups(claims?.['cognito:groups']) };
}

export const isAdmin = (user: User) => user.groups.includes('admins');

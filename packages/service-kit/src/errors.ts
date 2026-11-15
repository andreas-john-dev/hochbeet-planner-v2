import type { ErrorKey, ErrorResponse } from '@hochbeet/contracts';
import type { z } from 'zod';

export type Issue = NonNullable<ErrorResponse['issues']>[number];

/**
 * An error the service answers with `status` and the text of `key` in the caller's language.
 * Issue messages may be keys of the contracts (`messageKey()`), they become text as well.
 */
export class ServiceError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409,
    readonly key: ErrorKey,
    readonly issues: Issue[] = [],
  ) {
    super(key);
    this.name = 'ServiceError';
  }
}

/** 400 with field-level issues, rendered as `ErrorResponse`. */
export class ValidationError extends ServiceError {
  constructor(key: ErrorKey, issues: Issue[]) {
    super(400, key, issues);
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends ServiceError {
  constructor(key: ErrorKey) {
    super(403, key);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(key: ErrorKey) {
    super(404, key);
    this.name = 'NotFoundError';
  }
}

/** 409: the request no longer fits the current state, e.g. an already handled publication. */
export class ConflictError extends ServiceError {
  constructor(key: ErrorKey) {
    super(409, key);
    this.name = 'ConflictError';
  }
}

/** Issues of a failed parse; own messages stay keys until the response is written. */
export const issuesOf = (error: z.ZodError): Issue[] =>
  error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

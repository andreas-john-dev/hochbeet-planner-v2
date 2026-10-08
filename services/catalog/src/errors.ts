import type { ErrorResponse } from '@hochbeet/contracts';
import type { z } from 'zod';

export type Issue = NonNullable<ErrorResponse['issues']>[number];

/** 400 with field-level issues, rendered as `ErrorResponse`. */
export class ValidationError extends Error {
  constructor(
    message: string,
    readonly issues: Issue[],
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export const issuesOf = (error: z.ZodError): Issue[] =>
  error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

/** 409: the request no longer fits the current state, e.g. an already handled publication. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

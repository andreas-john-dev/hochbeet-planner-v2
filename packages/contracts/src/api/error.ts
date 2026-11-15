import { z } from 'zod';

/**
 * Body of every 4xx/5xx response of both services. `message` and the issues are shown to the
 * user, in the language of `Accept-Language` (`localeFromHeader()`, German by default).
 */
export const ErrorResponseSchema = z.object({
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

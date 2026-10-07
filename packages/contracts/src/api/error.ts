import { z } from 'zod';

/** Body of every 4xx/5xx response of both services. `message` is shown to the user (German). */
export const ErrorResponseSchema = z.object({
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

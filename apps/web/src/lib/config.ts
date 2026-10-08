import { z } from 'zod';

/** Runtime configuration, served as /config.json (written by CDK in prod, by Vite in dev). */
export const AppConfigSchema = z.object({
  region: z.string().min(1),
  userPoolId: z.string().min(1),
  userPoolClientId: z.string().min(1),
  /** `mock` uses a local fake instead of Cognito (dev server and Playwright only). */
  authMode: z.enum(['cognito', 'mock']).default('cognito'),
  /** `mock` answers /api/* in the browser with MSW handlers (dev server and Playwright only). */
  apiMode: z.enum(['live', 'mock']).default('live'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export async function loadConfig(fetchFn: typeof fetch = fetch): Promise<AppConfig> {
  const response = await fetchFn('/config.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`config.json could not be loaded (HTTP ${String(response.status)})`);
  }
  return AppConfigSchema.parse(await response.json());
}

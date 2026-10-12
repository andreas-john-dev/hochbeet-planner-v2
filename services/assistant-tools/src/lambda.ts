import { createLogger } from '@hochbeet/service-kit';
import { createToolHandler } from './handler';

const apiBaseUrl = process.env.API_BASE_URL;
if (!apiBaseUrl) throw new Error('API_BASE_URL is not set');

/** Lambda entry of the tool target; API_BASE_URL is the app's domain (CloudFront → services). */
export const handler = createToolHandler({
  apiBaseUrl,
  logger: createLogger({ service: 'assistant-tools' }),
});

import type { ToolError } from '@hochbeet/contracts';
import type { Logger } from '@hochbeet/service-kit';
import type { Context } from 'aws-lambda';
import { createApiReader, type GardenReader } from './api';
import { bearerToken, TOKEN_ARGUMENT } from './interceptor';
import { isToolName, runTool, type ToolOutput } from './tools';

/** Separator between target and tool name in the names the gateway gives its tools. */
const TARGET_SEPARATOR = '___';

type Custom = Record<string, unknown> | undefined;

const customOf = (context: Pick<Context, 'clientContext'>): Custom =>
  (context.clientContext?.custom ?? undefined) as Custom;

/** Tool name without the target prefix, from the client context the gateway sets. */
export function toolNameOf(context: Pick<Context, 'clientContext'>): string | undefined {
  const name = customOf(context)?.bedrockAgentCoreToolName;
  if (typeof name !== 'string') return undefined;
  return name.split(TARGET_SEPARATOR).at(-1);
}

/**
 * The caller's token: the argument the request interceptor set, else the Authorization header
 * the gateway propagated. Never from anything the model controls: the interceptor overwrites
 * the argument on every call.
 */
export function tokenOf(
  event: Record<string, unknown>,
  context: Pick<Context, 'clientContext'>,
): string | undefined {
  const fromArgument = event[TOKEN_ARGUMENT];
  if (typeof fromArgument === 'string' && bearerToken(`Bearer ${fromArgument}`)) {
    return fromArgument;
  }
  const propagated = customOf(context)?.bedrockAgentCorePropagatedHeaders;
  if (propagated && typeof propagated === 'object') {
    const entry = Object.entries(propagated).find(([key]) => key.toLowerCase() === 'authorization');
    return typeof entry?.[1] === 'string' ? bearerToken(entry[1]) : undefined;
  }
  return undefined;
}

export interface ToolHandlerDeps {
  apiBaseUrl: string;
  logger: Logger;
  reader?: (token: string) => GardenReader;
}

/** Lambda target of the gateway: one function for all read-only tools. */
export function createToolHandler({ apiBaseUrl, logger, reader }: ToolHandlerDeps) {
  const readerFor = reader ?? ((token: string) => createApiReader(apiBaseUrl, token));
  return async (
    event: Record<string, unknown>,
    context: Pick<Context, 'clientContext'>,
  ): Promise<ToolOutput | ToolError> => {
    const tool = toolNameOf(context);
    if (!tool || !isToolName(tool)) {
      logger.warn('unknown tool', { tool });
      return { error: 'Dieses Werkzeug gibt es nicht.' };
    }
    const token = tokenOf(event, context);
    if (!token) {
      logger.warn('tool call without token', { tool });
      return { error: 'Bitte melde dich an.' };
    }
    const { [TOKEN_ARGUMENT]: _token, ...args } = event;
    const started = Date.now();
    const result = await runTool(tool, args, readerFor(token));
    // Only the tool and the outcome; arguments and token stay out of the logs.
    logger.info('tool call', {
      tool,
      ok: !('error' in result),
      durationMs: Date.now() - started,
    });
    return result;
  };
}

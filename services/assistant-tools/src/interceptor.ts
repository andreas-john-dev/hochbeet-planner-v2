/**
 * Request interceptor of the AgentCore Gateway. The gateway has already verified the caller's
 * Cognito ID token (inbound JWT authorizer). Before every tool call this hands that token to
 * the tool Lambda, which calls the service APIs with it, so the services keep taking the
 * userId from `sub`. Whatever the model put into the token argument is replaced; the token is
 * never logged.
 */

/** Tool argument that carries the caller's bearer token; set here, never by the model. */
export const TOKEN_ARGUMENT = '__userToken';

export interface InterceptorEvent {
  interceptorInputVersion?: string;
  mcp?: {
    gatewayRequest?: {
      headers?: Record<string, string | undefined>;
      body?: unknown;
    };
  };
}

export interface InterceptorResult {
  interceptorOutputVersion: '1.0';
  mcp: {
    transformedGatewayRequest: {
      headers?: Record<string, string>;
      body: unknown;
    };
  };
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function header(headers: Record<string, string | undefined>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === wanted)?.[1];
}

/** The token of `Authorization: Bearer <token>`, if it looks like a JWT. */
export function bearerToken(authorization: string | undefined): string | undefined {
  const [scheme, token, ...rest] = (authorization ?? '').trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return undefined;
  return token.split('.').length === 3 ? token : undefined;
}

/** A `tools/call` request with the token argument set (or removed when there is no token). */
function withToken(body: JsonObject, token: string | undefined): JsonObject {
  if (body.method !== 'tools/call' || !isObject(body.params)) return body;
  const { [TOKEN_ARGUMENT]: _fromModel, ...args } = isObject(body.params.arguments)
    ? body.params.arguments
    : {};
  return {
    ...body,
    params: { ...body.params, arguments: token ? { ...args, [TOKEN_ARGUMENT]: token } : args },
  };
}

function transformBody(body: unknown, token: string | undefined): unknown {
  if (isObject(body)) return withToken(body, token);
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      return isObject(parsed) ? JSON.stringify(withToken(parsed, token)) : body;
    } catch {
      return body;
    }
  }
  return body;
}

export function interceptRequest(event: InterceptorEvent): InterceptorResult {
  const request = event.mcp?.gatewayRequest ?? {};
  const authorization = header(request.headers ?? {}, 'Authorization');
  const token = bearerToken(authorization);
  return {
    interceptorOutputVersion: '1.0',
    mcp: {
      transformedGatewayRequest: {
        // Also forwarded as header; the Lambda reads it from the client context if the
        // gateway passes it on (header propagation), the argument is the primary path.
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        body: transformBody(request.body, token),
      },
    },
  };
}

/** Lambda entry of the interceptor. */
export const handler = (event: InterceptorEvent): Promise<InterceptorResult> =>
  Promise.resolve(interceptRequest(event));

import { describe, expect, it } from 'vitest';
import { bearerToken, interceptRequest, TOKEN_ARGUMENT } from './interceptor';
import { tokenFor } from './test-utils';

const token = tokenFor('user-a');

const toolCall = (args: Record<string, unknown>) => ({
  jsonrpc: '2.0',
  id: 7,
  method: 'tools/call',
  params: { name: 'garden___get_bed', arguments: args },
});

const event = (body: unknown, headers: Record<string, string> = {}) => ({
  interceptorInputVersion: '1.0',
  mcp: { gatewayRequest: { headers, body } },
});

describe('request interceptor', () => {
  it('hands the caller token to every tool call and forwards it as header', () => {
    const result = interceptRequest(
      event(toolCall({ bedId: 'B1' }), { authorization: `Bearer ${token}` }),
    );
    expect(result).toEqual({
      interceptorOutputVersion: '1.0',
      mcp: {
        transformedGatewayRequest: {
          headers: { Authorization: `Bearer ${token}` },
          body: toolCall({ bedId: 'B1', [TOKEN_ARGUMENT]: token }),
        },
      },
    });
  });

  it('replaces a token the model put into the arguments', () => {
    const other = tokenFor('user-b');
    const result = interceptRequest(
      event(toolCall({ bedId: 'B1', [TOKEN_ARGUMENT]: other }), {
        Authorization: `Bearer ${token}`,
      }),
    );
    expect(result.mcp.transformedGatewayRequest.body).toEqual(
      toolCall({ bedId: 'B1', [TOKEN_ARGUMENT]: token }),
    );
  });

  it('removes a token from the model when the request carries none', () => {
    const result = interceptRequest(
      event(toolCall({ bedId: 'B1', [TOKEN_ARGUMENT]: tokenFor('user-b') })),
    );
    expect(result.mcp.transformedGatewayRequest).toEqual({ body: toolCall({ bedId: 'B1' }) });
  });

  it('leaves other MCP requests unchanged', () => {
    const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    expect(
      interceptRequest(event(list, { Authorization: `Bearer ${token}` })).mcp
        .transformedGatewayRequest.body,
    ).toEqual(list);
  });

  it('also handles a body that arrives as JSON text', () => {
    const result = interceptRequest(
      event(JSON.stringify(toolCall({})), { Authorization: `Bearer ${token}` }),
    );
    expect(JSON.parse(result.mcp.transformedGatewayRequest.body as string)).toEqual(
      toolCall({ [TOKEN_ARGUMENT]: token }),
    );
  });

  it('accepts only bearer tokens that look like a JWT', () => {
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
    expect(bearerToken(`bearer  ${token}`)).toBe(token);
    expect(bearerToken(token)).toBeUndefined();
    expect(bearerToken('Bearer abc')).toBeUndefined();
    expect(bearerToken(`Bearer ${token} extra`)).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });
});

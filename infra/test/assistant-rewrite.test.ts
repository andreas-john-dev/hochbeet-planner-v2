import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface CloudFrontRequest {
  method: string;
  uri: string;
  querystring: Record<string, { value: string }>;
}
type Handler = (event: {
  request: CloudFrontRequest;
}) => CloudFrontRequest | { statusCode: number };

const ARN = 'arn:aws:bedrock-agentcore:eu-central-1:123456789012:runtime/prod_bed_assistant-Ab1';

// Load the CloudFront Function as it is deployed, with the ARN filled in like the stack does.
const code = readFileSync(
  new URL('../lib/frontend/assistant-rewrite.js', import.meta.url),
  'utf8',
).replace('__RUNTIME_ARN__', ARN);
// eslint-disable-next-line @typescript-eslint/no-implied-eval -- evaluates our own function source
const loadHandler = new Function(`${code}\nreturn handler;`) as () => Handler;
const handler = loadHandler();

const call = (method: string, uri: string) =>
  handler({ request: { method, uri, querystring: { foo: { value: 'bar' } } } });

describe('assistant-rewrite CloudFront Function', () => {
  it('maps the invocation to the runtime with the URL-encoded ARN and DEFAULT qualifier', () => {
    expect(call('POST', '/api/assistant/invocations')).toEqual({
      method: 'POST',
      uri: `/runtimes/${encodeURIComponent(ARN)}/invocations`,
      querystring: { qualifier: { value: 'DEFAULT' } },
    });
  });

  it.each([
    ['GET', '/api/assistant/invocations'],
    ['POST', '/api/assistant/other'],
    ['POST', '/api/assistant/invocations/../ping'],
  ])('answers %s %s with 404', (method, uri) => {
    expect(call(method, uri)).toEqual({ statusCode: 404, statusDescription: 'Not Found' });
  });
});

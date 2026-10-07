import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface CloudFrontRequest {
  uri: string;
}
type Handler = (event: { request: CloudFrontRequest }) => CloudFrontRequest;

// Load the CloudFront Function exactly as it is deployed.
const code = readFileSync(new URL('../lib/frontend/spa-rewrite.js', import.meta.url), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-implied-eval -- evaluates our own function source
const loadHandler = new Function(`${code}\nreturn handler;`) as () => Handler;
const handler = loadHandler();

const rewrite = (uri: string) => handler({ request: { uri } }).uri;

describe('spa-rewrite CloudFront Function', () => {
  it.each(['/', '/beete', '/beete/123', '/katalog/', '/admin/publikationen/abc'])(
    'serves index.html for the client-side route %s',
    (uri) => {
      expect(rewrite(uri)).toBe('/index.html');
    },
  );

  it.each(['/assets/index-AbC123.js', '/config.json', '/favicon.ico', '/index.html'])(
    'passes the file %s through',
    (uri) => {
      expect(rewrite(uri)).toBe(uri);
    },
  );
});

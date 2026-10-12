// CloudFront Function (viewer request, runtime cloudfront-js-2.0) on /api/assistant/*.
// The browser posts to /api/assistant/invocations on the app's own domain; this maps it to
// the AgentCore Runtime's invocation path. The runtime checks the ID token (Authorization)
// itself. The stack replaces the placeholder below with the runtime ARN at synth time.
var RUNTIME_ARN = '__RUNTIME_ARN__';

// eslint-disable-next-line no-unused-vars -- entry point, invoked by CloudFront
function handler(event) {
  var request = event.request;
  if (request.uri !== '/api/assistant/invocations' || request.method !== 'POST') {
    return { statusCode: 404, statusDescription: 'Not Found' };
  }
  request.uri = '/runtimes/' + encodeURIComponent(RUNTIME_ARN) + '/invocations';
  request.querystring = { qualifier: { value: 'DEFAULT' } };
  return request;
}

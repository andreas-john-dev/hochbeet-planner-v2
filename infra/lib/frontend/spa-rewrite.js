// CloudFront Function (viewer request, runtime cloudfront-js-2.0) on the default behaviour.
// Paths without a file extension are client-side routes of the SPA and get index.html.
// API paths never reach this function: they have their own behaviours.
// eslint-disable-next-line no-unused-vars -- entry point, invoked by CloudFront
function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.slice(request.uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}

/** Only allow redirects to paths of this app, never to other origins. */
export function safeRedirect(target: unknown, fallback = '/beete'): string {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : fallback;
}

import { describe, expect, it } from 'vitest';
import { safeRedirect } from './redirect';

describe('safeRedirect', () => {
  it('keeps paths of the app', () => {
    expect(safeRedirect('/katalog?x=1')).toBe('/katalog?x=1');
  });

  it.each(['https://evil.example', '//evil.example', 'katalog', undefined, 42])(
    'falls back for %s',
    (target) => {
      expect(safeRedirect(target)).toBe('/beete');
    },
  );
});

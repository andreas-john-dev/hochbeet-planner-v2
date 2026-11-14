import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { i18n } from '../lib/i18n';

// jsdom reports an English browser; unit tests run in German like the app's default.
void i18n.changeLanguage('de');

afterEach(() => {
  cleanup();
  void i18n.changeLanguage('de');
});

// jsdom has no matchMedia; the theme provider needs it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

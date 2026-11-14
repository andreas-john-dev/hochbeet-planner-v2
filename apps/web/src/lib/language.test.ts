import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dateLocale,
  detectLanguage,
  initialLanguage,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
  storeLanguage,
} from './language';

describe('detectLanguage', () => {
  it('prefers the stored language', () => {
    expect(detectLanguage('en', ['de-DE'])).toBe('en');
    expect(detectLanguage('de', ['en-US'])).toBe('de');
  });

  it('ignores a stored value the app does not know', () => {
    expect(detectLanguage('fr', ['de-AT'])).toBe('de');
  });

  it('follows the browser: de* is German, English otherwise', () => {
    expect(detectLanguage(null, ['de-CH', 'en'])).toBe('de');
    expect(detectLanguage(null, ['DE'])).toBe('de');
    expect(detectLanguage(null, ['en-US', 'de-DE'])).toBe('en');
    expect(detectLanguage(null, ['fr-FR'])).toBe('en');
  });

  it('takes the first language the app speaks', () => {
    expect(detectLanguage(null, ['fr-FR', 'de-DE'])).toBe('de');
  });

  it('falls back to German without any browser language', () => {
    expect(detectLanguage(null, [])).toBe('de');
  });
});

describe('stored language', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('is read back after storing', () => {
    storeLanguage('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(readStoredLanguage()).toBe('en');
    expect(initialLanguage()).toBe('en');
  });

  it('starts from the browser when localStorage is not available', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
    expect(() => {
      storeLanguage('en');
    }).not.toThrow();
    expect(readStoredLanguage()).toBeNull();
    expect(initialLanguage()).toBe('de');
  });
});

describe('dateLocale', () => {
  it('is German or British English', () => {
    expect(dateLocale('de').code).toBe('de');
    expect(dateLocale('en').code).toBe('en-GB');
  });
});

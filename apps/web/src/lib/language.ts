import type { Locale } from 'date-fns';
import { de, enGB } from 'date-fns/locale';

/** Languages of the app. German is the default and the source of all texts. */
export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'de';

export const LANGUAGE_STORAGE_KEY = 'hochbeet-language';

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value);
}

/**
 * Start language: the stored choice, else the browser's first language the app speaks
 * (`de-AT` → `de`, `en-US` → `en`), else English for any other browser language. Without any
 * browser language, German.
 */
export function detectLanguage(
  stored: string | null,
  browserLanguages: readonly string[],
): Language {
  if (isLanguage(stored)) return stored;
  if (browserLanguages.length === 0) return DEFAULT_LANGUAGE;
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return 'en';
}

export function readStoredLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this visit.
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages.length > 0) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

export function initialLanguage(): Language {
  return detectLanguage(readStoredLanguage(), browserLanguages());
}

/** date-fns locale of a language; English is en-GB (weeks start on Monday). */
export function dateLocale(language: Language): Locale {
  return language === 'en' ? enGB : de;
}

import type { Locale } from 'date-fns';
import i18n from 'i18next';
import { useCallback } from 'react';
import { initReactI18next, useTranslation } from 'react-i18next';
import { de, type Resources } from '@/locales/de';
import { en } from '@/locales/en';
import {
  dateLocale,
  DEFAULT_LANGUAGE,
  initialLanguage,
  isLanguage,
  LANGUAGES,
  storeLanguage,
  type Language,
} from './language';
import { setZodLocale } from './zod-locale';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: Resources;
  }
}

/** Keeps the page in step with the language: `<html lang>`, title and Zod's default messages. */
function applyLanguage(language: Language) {
  setZodLocale(language);
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.title = i18n.t('common:appName');
}

i18n.on('languageChanged', (lng) => {
  applyLanguage(isLanguage(lng) ? lng : DEFAULT_LANGUAGE);
});

// Texts are bundled, so init runs synchronously and the first render is already translated.
void i18n.use(initReactI18next).init({
  resources: { de, en },
  lng: initialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  ns: Object.keys(de),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  initAsync: false,
});

export { i18n };

/** The current language, for code outside React (e.g. the `Accept-Language` header). */
export function currentLanguage(): Language {
  const lng = i18n.resolvedLanguage ?? i18n.language;
  return isLanguage(lng) ? lng : DEFAULT_LANGUAGE;
}

export interface LanguageValue {
  language: Language;
  /** Switches the app and remembers the choice in this browser. */
  setLanguage: (language: Language) => void;
}

/** Language of the app, analogous to `useTheme()`. */
export function useLanguage(): LanguageValue {
  const { i18n: instance } = useTranslation();
  const lng = instance.resolvedLanguage ?? instance.language;
  const setLanguage = useCallback(
    (next: Language) => {
      storeLanguage(next);
      void instance.changeLanguage(next);
    },
    [instance],
  );
  return { language: isLanguage(lng) ? lng : DEFAULT_LANGUAGE, setLanguage };
}

/** date-fns locale of the current language: `de` or `enGB`. */
export function useDateLocale(): Locale {
  return dateLocale(useLanguage().language);
}

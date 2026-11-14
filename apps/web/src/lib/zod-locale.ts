import { z } from 'zod';
import type { Language } from './language';

/** Default messages for schema errors without their own message, like in the services. */
export function setZodLocale(language: Language): void {
  z.config(language === 'en' ? z.locales.en() : z.locales.de());
}

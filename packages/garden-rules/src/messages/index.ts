import { DEFAULT_RULES_LOCALE, type RulesLocale } from '../locale';
import { de } from './de';
import { en } from './en';
import type { Messages } from './types';

export type { Messages, MonthPart } from './types';

const MESSAGES: Record<RulesLocale, Messages> = { de, en };

/** The texts of a language; German without one. */
export const messagesFor = (locale: RulesLocale = DEFAULT_RULES_LOCALE): Messages =>
  MESSAGES[locale];

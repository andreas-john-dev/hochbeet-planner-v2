/** Languages the rule engine writes its texts in. German is the default. */
export const RULES_LOCALES = ['de', 'en'] as const;
export type RulesLocale = (typeof RULES_LOCALES)[number];

export const DEFAULT_RULES_LOCALE: RulesLocale = 'de';

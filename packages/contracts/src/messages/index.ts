import { z } from 'zod';
import { de } from './de';
import { en } from './en';
import { DEFAULT_LOCALE, LOCALES, type Locale, type Messages } from './types';

export {
  DEFAULT_LOCALE,
  type ImportKind,
  LOCALES,
  type Locale,
  type Messages,
  type Unit,
} from './types';

type Validation = Messages['validation'];
export type ValidationId = keyof Validation;
/** Id of an error response's `message`, e.g. `bedNotFound`. */
export type ErrorKey = keyof Messages['errors'];

type ParamsOf<K extends ValidationId> = Validation[K] extends (params: infer P) => string
  ? [params: P]
  : [];

const MESSAGES: Record<Locale, Messages> = { de, en };

/** All texts of a language; German without one. */
export const messagesFor = (locale: Locale = DEFAULT_LOCALE): Messages => MESSAGES[locale];

const SEPARATOR = '|';

/**
 * The message a schema stores instead of a text: the stable id, with its params as JSON
 * after `|`, e.g. `maxChars|{"max":60}`. `localizeMessage()` turns it into text.
 */
export function messageKey<K extends ValidationId>(id: K, ...params: ParamsOf<K>): string {
  const [values] = params;
  return values === undefined ? id : `${id}${SEPARATOR}${JSON.stringify(values)}`;
}

const has = (texts: object, id: string) => Object.hasOwn(texts, id);

/**
 * Text of a message in `locale`: own keys of the schemas (`messageKey()`) and error keys
 * become text, anything else (e.g. Zod's default messages) stays as it is.
 */
export function localizeMessage(message: string, locale: Locale = DEFAULT_LOCALE): string {
  const at = message.indexOf(SEPARATOR);
  const id = at < 0 ? message : message.slice(0, at);
  const texts = messagesFor(locale);
  if (has(texts.errors, id)) return texts.errors[id as ErrorKey];
  if (!has(texts.validation, id)) return message;
  const entry = texts.validation[id as ValidationId];
  if (typeof entry === 'string') return entry;
  if (at < 0) return message;
  try {
    return (entry as (params: unknown) => string)(JSON.parse(message.slice(at + 1)));
  } catch {
    return message;
  }
}

/** Field issue as in `ErrorResponse`, e.g. `{ path: 'beds.0.name', message: '…' }`. */
export interface LocalizedIssue {
  path: string;
  message: string;
}

/** The issues of a failed parse as text in `locale`, with the path joined by dots. */
export const localizeIssues = (
  error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] },
  locale: Locale = DEFAULT_LOCALE,
): LocalizedIssue[] =>
  error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: localizeMessage(issue.message, locale),
  }));

const ZOD_LOCALES: Record<Locale, () => { localeError: z.core.$ZodErrorMap }> = {
  de: z.locales.de,
  en: z.locales.en,
};
const errorMaps = new Map<Locale, z.core.$ZodErrorMap>();

/** Zod's default messages in `locale`, for one parse (`schema.safeParse(value, { error })`). */
export function zodErrorMap(locale: Locale = DEFAULT_LOCALE): z.core.$ZodErrorMap {
  let map = errorMaps.get(locale);
  if (!map) {
    map = ZOD_LOCALES[locale]().localeError;
    errorMaps.set(locale, map);
  }
  return map;
}

/**
 * Parses with Zod's default messages in `locale`. The own messages stay keys until
 * `localizeIssues()`; they come first, so the error map only fills the rest.
 */
export const safeParseIn = <T extends z.ZodType>(schema: T, value: unknown, locale: Locale) =>
  schema.safeParse(value, { error: zodErrorMap(locale) });

/**
 * Language of an `Accept-Language` header: the first tag decides, `en` and `en-GB` count as
 * English, everything else (also no header) as German.
 */
export function localeFromHeader(header: string | null | undefined): Locale {
  const first = header?.split(',')[0]?.split(';')[0]?.trim().toLowerCase() ?? '';
  const language = first.split('-')[0] ?? '';
  return (LOCALES as readonly string[]).includes(language) ? (language as Locale) : DEFAULT_LOCALE;
}

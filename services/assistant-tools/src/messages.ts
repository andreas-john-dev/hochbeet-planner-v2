import { DEFAULT_LOCALE, type Locale } from '@hochbeet/contracts';

/**
 * Texts the tools return to the model: `error` messages and the placeholder for a plant that
 * is gone from the catalogue. In the language of the agent's request (`Accept-Language`, set
 * as tool argument by the interceptor); the agent passes errors on to the user.
 */
const de = {
  unreachable: 'Die Gartendaten sind gerade nicht erreichbar.',
  unreadable: 'Die Gartendaten sind gerade nicht lesbar.',
  forbidden: 'Keine Berechtigung für diese Daten.',
  bedNotFound: 'Das Beet gibt es nicht.',
  invalidBedId: 'Bitte gib eine gültige Beet-ID an.',
  invalidEvaluation: 'Bitte gib eine gültige Beet-ID und optional ein Datum (JJJJ-MM-TT) an.',
  queryTooLong: 'Bitte gib einen kürzeren Suchbegriff an.',
  unknownTool: 'Dieses Werkzeug gibt es nicht.',
  signIn: 'Bitte melde dich an.',
  unknownPlant: 'Unbekannte Sorte',
};

export type ToolMessageKey = keyof typeof de;

const en: Record<ToolMessageKey, string> = {
  unreachable: 'The garden data cannot be reached right now.',
  unreadable: 'The garden data cannot be read right now.',
  forbidden: 'No permission for this data.',
  bedNotFound: 'This bed does not exist.',
  invalidBedId: 'Please give a valid bed ID.',
  invalidEvaluation: 'Please give a valid bed ID and optionally a date (YYYY-MM-DD).',
  queryTooLong: 'Please give a shorter search term.',
  unknownTool: 'This tool does not exist.',
  signIn: 'Please sign in.',
  unknownPlant: 'Unknown variety',
};

const MESSAGES: Record<Locale, Record<ToolMessageKey, string>> = { de, en };

export const toolMessage = (key: ToolMessageKey, locale: Locale = DEFAULT_LOCALE): string =>
  MESSAGES[locale][key];

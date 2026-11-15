import { describe, expect, it } from 'vitest';
import { BedFieldsSchema, SowingBatchFieldsSchema, SowingSchema } from '../domain';
import { de } from './de';
import { en } from './en';
import {
  localeFromHeader,
  localizeIssues,
  localizeMessage,
  messageKey,
  messagesFor,
  safeParseIn,
} from './index';
import type { ImportKind, Messages, Unit } from './types';

const UNITS: Unit[] = ['weeks', 'days', 'celsius', 'pieces'];
const KINDS: ImportKind[] = ['beds', 'plantings', 'sowings', 'plants', 'overrides'];

/** Every text of a language, functions called with all their variants. */
function allTexts(messages: Messages): Record<string, string> {
  const texts: Record<string, string> = { ...messages.errors };
  for (const [id, entry] of Object.entries(messages.validation)) {
    if (typeof entry === 'string') {
      texts[id] = entry;
      continue;
    }
    const call = entry as (params: Record<string, unknown>) => string;
    for (const unit of UNITS) {
      for (const kind of KINDS) {
        texts[`${id}:${unit}:${kind}`] = call({ min: 1, max: 26, step: 5, unit, kind });
      }
    }
  }
  return texts;
}

describe('contract messages', () => {
  it('have a text for every message in German and English', () => {
    const german = allTexts(de);
    const english = allTexts(en);
    expect(Object.keys(english)).toEqual(Object.keys(german));
    for (const [id, text] of Object.entries(german)) {
      expect(text, id).toMatch(/\S/);
      expect(english[id], id).toMatch(/\S/);
      expect(english[id], id).not.toBe(text);
      expect(`${text} ${english[id] ?? ''}`, id).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it('use every id only once across schema and error messages', () => {
    const validation = Object.keys(de.validation);
    expect(Object.keys(de.errors).filter((id) => validation.includes(id))).toEqual([]);
  });

  it('turn keys with and without params into text', () => {
    expect(messageKey('nameRequired')).toBe('nameRequired');
    expect(messageKey('maxChars', { max: 60 })).toBe('maxChars|{"max":60}');
    expect(localizeMessage(messageKey('maxChars', { max: 60 }))).toBe('Höchstens 60 Zeichen.');
    expect(localizeMessage(messageKey('maxChars', { max: 60 }), 'en')).toBe(
      'At most 60 characters.',
    );
    expect(localizeMessage('bedNotFound', 'en')).toBe('This bed does not exist.');
    expect(messagesFor().errors.bedNotFound).toBe('Dieses Beet gibt es nicht.');
  });

  it('leave other messages as they are', () => {
    expect(localizeMessage('Zu groß: erwartet <=60', 'en')).toBe('Zu groß: erwartet <=60');
    expect(localizeMessage('maxChars', 'en')).toBe('maxChars');
    expect(localizeMessage('maxChars|kein JSON', 'en')).toBe('maxChars|kein JSON');
    expect(localizeMessage('toString', 'en')).toBe('toString');
  });

  it('formulate a failed parse in both languages, Zod defaults included', () => {
    const bed = { name: ' ', widthCm: 7, depthCm: 100, mainRowDirection: 'X', soilRenewals: [] };
    const issues = (locale: 'de' | 'en') => {
      const result = safeParseIn(BedFieldsSchema, bed, locale);
      return result.error ? localizeIssues(result.error, locale) : [];
    };
    expect(issues('de')).toEqual([
      { path: 'name', message: 'Bitte einen Namen angeben.' },
      { path: 'widthCm', message: 'Muss ein Vielfaches von 5 cm sein.' },
      { path: 'mainRowDirection', message: expect.stringMatching(/^Ungültige Option/) as string },
    ]);
    expect(issues('en')).toEqual([
      { path: 'name', message: 'Please enter a name.' },
      { path: 'widthCm', message: 'Must be a multiple of 5 cm.' },
      { path: 'mainRowDirection', message: expect.stringMatching(/^Invalid option/) as string },
    ]);
  });

  it('name ranges, counts and texts of sowing batches and windows in English', () => {
    const batch = SowingBatchFieldsSchema.safeParse({
      plantId: '01J9ZQ3W8D6V2K5M7N8P9R0S1T',
      sowDate: '2026-03-10',
      sownCount: 0,
      aliveCount: 1.5,
      stage: 'SOWN',
      notes: 'x'.repeat(501),
    });
    expect(batch.error && localizeIssues(batch.error, 'en')).toEqual([
      { path: 'sowDate', message: 'Must be a Monday.' },
      { path: 'sownCount', message: 'Enter a number from 1 to 9999.' },
      { path: 'aliveCount', message: 'Enter a whole number.' },
      { path: 'notes', message: 'At most 500 characters.' },
    ]);
    const sowing = SowingSchema.safeParse({
      method: 'PRESOW',
      presowWeeks: { from: 10, to: 54 },
      propagationWeeks: { min: 8, max: 6 },
      germinationTempC: { min: 10, max: 45 },
    });
    expect(sowing.error && localizeIssues(sowing.error, 'en')).toEqual([
      { path: 'presowWeeks.to', message: 'Enter a week from 1 to 53.' },
      {
        path: 'propagationWeeks.max',
        message: 'The “to” value must be at least the “from” value.',
      },
      { path: 'germinationTempC.max', message: 'Enter 0 to 40 °C.' },
    ]);
  });

  it('read the language from Accept-Language, German for everything else', () => {
    expect(localeFromHeader('en')).toBe('en');
    expect(localeFromHeader('en-GB,en;q=0.9,de;q=0.8')).toBe('en');
    expect(localeFromHeader('EN-us')).toBe('en');
    expect(localeFromHeader('de-DE')).toBe('de');
    expect(localeFromHeader('fr-FR,en;q=0.5')).toBe('de');
    expect(localeFromHeader('*')).toBe('de');
    expect(localeFromHeader('')).toBe('de');
    expect(localeFromHeader(null)).toBe('de');
    expect(localeFromHeader(undefined)).toBe('de');
  });
});

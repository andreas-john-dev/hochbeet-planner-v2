import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';

/** Every text with its dotted key, e.g. `layout:nav.beds`. */
function flatten(value: unknown, prefix: string): [string, unknown][] {
  if (typeof value !== 'object' || value === null) return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix.endsWith(':') ? `${prefix}${key}` : `${prefix}.${key}`),
  );
}

const texts = (resources: object) =>
  Object.entries(resources).flatMap(([ns, value]) => flatten(value, `${ns}:`));

describe('locales', () => {
  it('have the same keys in German and English', () => {
    const keys = (resources: object) => texts(resources).map(([key]) => key);
    expect(keys(en).sort()).toEqual(keys(de).sort());
  });

  it.each([
    ['de', de],
    ['en', en],
  ])('have no empty text in %s', (_, resources) => {
    const empty = texts(resources).filter(([, text]) => typeof text !== 'string' || !text.trim());
    expect(empty).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { familyName, type NamedPlant, plantName } from './plant-names';

const lettuce: NamedPlant = {
  name: 'Kopfsalat',
  family: 'Korbblütler',
  translations: { en: { name: 'Lettuce', family: 'Daisy family' } },
};

describe('plantName and familyName', () => {
  it('show the translation of a global plant, German by default', () => {
    expect(plantName(lettuce, 'en')).toBe('Lettuce');
    expect(familyName(lettuce, 'en')).toBe('Daisy family');
    expect(plantName(lettuce, 'de')).toBe('Kopfsalat');
    expect(familyName(lettuce)).toBe('Korbblütler');
  });

  it('keep an adjusted name in every language, the rest stays translated', () => {
    const adjusted: NamedPlant = {
      ...lettuce,
      name: 'Mein Salat',
      global: { name: 'Kopfsalat', family: 'Korbblütler' },
    };
    expect(plantName(adjusted, 'en')).toBe('Mein Salat');
    expect(plantName(adjusted, 'de')).toBe('Mein Salat');
    expect(familyName(adjusted, 'en')).toBe('Daisy family');
    const family: NamedPlant = { ...lettuce, family: 'Salate', global: adjusted.global };
    expect(plantName(family, 'en')).toBe('Lettuce');
    expect(familyName(family, 'en')).toBe('Salate');
  });

  it('show own plants as entered', () => {
    const own: NamedPlant = { name: 'Haferwurzel', family: 'Korbblütler' };
    expect(plantName(own, 'en')).toBe('Haferwurzel');
    expect(familyName(own, 'en')).toBe('Korbblütler');
  });

  it('fall back to the German name without a translation', () => {
    expect(plantName({ ...lettuce, translations: {} }, 'en')).toBe('Kopfsalat');
    expect(familyName({ ...lettuce, translations: undefined }, 'en')).toBe('Korbblütler');
  });
});

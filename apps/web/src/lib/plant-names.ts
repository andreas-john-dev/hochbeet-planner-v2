import { familyName, type NamedPlant, plantName } from '@hochbeet/contracts';
import { useMemo } from 'react';
import { useLanguage } from './i18n';
import { intlLocale, type Language } from './language';

export { familyName, type NamedPlant, plantName };

const normalize = (text: string) => text.toLocaleLowerCase('de').trim();

/** Compares plants by their name in `language`, e.g. for sorted lists. */
export function byPlantName(language: Language) {
  const collator = new Intl.Collator(intlLocale(language));
  return (a: NamedPlant, b: NamedPlant) =>
    collator.compare(plantName(a, language), plantName(b, language));
}

/**
 * Whether the search `query` is part of a plant's name, in German or English whatever the
 * language of the app: "Kopfsalat" and "lettuce" both find the lettuce.
 */
export function matchesPlantName(plant: NamedPlant, query: string): boolean {
  const q = normalize(query);
  return [plant.name, plantName(plant, 'en')].some((name) => normalize(name).includes(q));
}

/** `plantName()`, `familyName()` and `byPlantName()` in the current language. */
export function usePlantNames() {
  const { language } = useLanguage();
  return useMemo(
    () => ({
      plantName: (plant: NamedPlant) => plantName(plant, language),
      familyName: (plant: NamedPlant) => familyName(plant, language),
      byPlantName: byPlantName(language),
    }),
    [language],
  );
}

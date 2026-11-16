import type { Plant, PlantFields, PlantTranslation } from './domain';
import { DEFAULT_LOCALE, type Locale } from './messages';

/**
 * What the names need of a plant. `global` holds the unchanged global values of an adjusted
 * global plant (`CatalogPlant.global`).
 */
export type NamedPlant = Pick<Plant, 'name' | 'family' | 'translations'> & {
  global?: Pick<PlantFields, 'name' | 'family'> | undefined;
};

function displayed(plant: NamedPlant, field: 'name' | 'family', locale: Locale): string {
  const translations: Partial<Record<Locale, PlantTranslation>> = plant.translations ?? {};
  const translated = locale === DEFAULT_LOCALE ? undefined : translations[locale]?.[field];
  // A personal adjustment holds in every language, like the names of own plants.
  const adjusted = plant.global !== undefined && plant.global[field] !== plant[field];
  return translated && !adjusted ? translated : plant[field];
}

/**
 * Name of a plant in `locale`: the translation of a global plant, else the stored (German or
 * own) name. Only for display: forms, overrides and the rules keep the stored name.
 */
export const plantName = (plant: NamedPlant, locale: Locale = DEFAULT_LOCALE): string =>
  displayed(plant, 'name', locale);

/**
 * Family of a plant in `locale`, like `plantName()`. Crop rotation compares the stored
 * `family`, never this text.
 */
export const familyName = (plant: NamedPlant, locale: Locale = DEFAULT_LOCALE): string =>
  displayed(plant, 'family', locale);

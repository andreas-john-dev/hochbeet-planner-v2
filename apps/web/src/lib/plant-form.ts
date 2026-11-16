import type {
  CatalogPlant,
  Category,
  GlobalPlantFields,
  Lifecycle,
  PlantTranslations,
} from '@hochbeet/contracts';
import { CATEGORY_ICONS, hasIcon } from '@hochbeet/plant-icons';
import { type AdjustErrors, type AdjustForm, adjustForm, parseAdjustForm } from './catalog';
import { i18n } from './i18n';
import type { Language } from './language';
import { EMPTY_SOWING_FORM } from './sowing-form';

/** Form values of an own plant; `icon: null` means the category icon. */
export interface PlantForm extends AdjustForm {
  name: string;
  category: Category;
  goodNeighbors: string[];
  badNeighbors: string[];
  color: string;
  icon: string | null;
  /**
   * English name and family, only in the form of global plants (admin): own plants have no
   * translations.
   */
  english?: { name: string; family: string };
}

export type PlantFormErrors = AdjustErrors & {
  name?: string;
  englishName?: string;
  englishFamily?: string;
};

/** Starting colour of the footprint per category; the user can change it. */
export const DEFAULT_COLOR: Record<Category, string> = {
  GEMUESE: '#4f9d4a',
  OBST: '#d9534f',
  KRAUT: '#6a994e',
};

/** The lifecycle choices; the form explains each in the bed (`form.lifecycleOption`). */
export const LIFECYCLE_TYPES: readonly Lifecycle['type'][] = ['ANNUAL', 'MULTI_YEAR', 'PERENNIAL'];

export const EMPTY_PLANT_FORM: PlantForm = {
  name: '',
  category: 'GEMUESE',
  family: '',
  feeder: 'MITTEL',
  spacingInRowCm: '',
  rowSpacingCm: '',
  lifecycleType: 'ANNUAL',
  lifecycleValue: '',
  sowing: EMPTY_SOWING_FORM,
  goodNeighbors: [],
  badNeighbors: [],
  color: DEFAULT_COLOR.GEMUESE,
  icon: null,
};

/** The form for editing an existing own plant. */
export function plantForm(plant: CatalogPlant): PlantForm {
  return {
    ...adjustForm(plant),
    name: plant.name,
    category: plant.category,
    goodNeighbors: [...plant.goodNeighbors],
    badNeighbors: [...plant.badNeighbors],
    color: plant.color,
    icon: plant.icon.startsWith('category-') || !hasIcon(plant.icon) ? null : plant.icon,
  };
}

/** The form of a global plant: like `plantForm()`, plus its English name and family. */
export function globalPlantForm(plant: CatalogPlant | undefined): PlantForm {
  const en = plant?.translations?.en;
  return {
    ...(plant ? plantForm(plant) : EMPTY_PLANT_FORM),
    english: { name: en?.name ?? '', family: en?.family ?? '' },
  };
}

/**
 * Translations from the English fields: none when both are empty, both are needed otherwise.
 * Without English fields (own plants), nothing.
 */
function parseEnglish(
  english: PlantForm['english'],
  language: Language,
): { translations?: PlantTranslations } | { errors: PlantFormErrors } {
  const name = english?.name.trim() ?? '';
  const family = english?.family.trim() ?? '';
  if (name === '' && family === '') return {};
  if (name !== '' && family !== '') return { translations: { en: { name, family } } };
  const t = i18n.getFixedT(language, 'catalog');
  return {
    errors:
      name === ''
        ? { englishName: t('errors.englishName') }
        : { englishFamily: t('errors.englishFamily') },
  };
}

/** Checks the form; returns the plant fields or messages per field in `language`. */
export function parsePlantForm(
  form: PlantForm,
  language: Language,
): { fields: GlobalPlantFields } | { errors: PlantFormErrors } {
  const name = form.name.trim();
  const rest = parseAdjustForm(form, language);
  const english = parseEnglish(form.english, language);
  if (name === '' || 'errors' in rest || 'errors' in english) {
    return {
      errors: {
        ...('errors' in rest ? rest.errors : {}),
        ...('errors' in english ? english.errors : {}),
        ...(name === '' ? { name: i18n.getFixedT(language, 'catalog')('errors.name') } : {}),
      },
    };
  }
  const { family, feeder, spacingInRowCm, rowSpacingCm, lifecycle, frostSensitive, sowing } =
    rest.fields;
  if (!family || !feeder || !spacingInRowCm || !rowSpacingCm || !lifecycle) {
    throw new Error('incomplete adjust form');
  }
  return {
    fields: {
      name,
      category: form.category,
      family,
      feeder,
      spacingInRowCm,
      rowSpacingCm,
      lifecycle,
      goodNeighbors: form.goodNeighbors,
      badNeighbors: form.badNeighbors,
      color: form.color,
      icon: form.icon ?? CATEGORY_ICONS[form.category],
      // Missing means false, so only a frost sensitive plant stores the flag.
      ...(frostSensitive ? { frostSensitive } : {}),
      ...(sowing ? { sowing } : {}),
      ...english,
    },
  };
}

/**
 * Own plants among the neighbours: only global plants can be published, so these have to go
 * before asking for publication.
 */
export function ownNeighbors(plant: CatalogPlant, catalog: readonly CatalogPlant[]) {
  const ids = new Set([...plant.goodNeighbors, ...plant.badNeighbors]);
  return catalog.filter((p) => p.source === 'OWN' && ids.has(p.id));
}

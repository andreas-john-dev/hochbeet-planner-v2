import type { CatalogPlant, Category, Lifecycle, PlantFields } from '@hochbeet/contracts';
import { CATEGORY_ICONS, hasIcon } from '@hochbeet/plant-icons';
import { type AdjustErrors, type AdjustForm, adjustForm, parseAdjustForm } from './catalog';

/** Form values of an own plant; `icon: null` means the category icon. */
export interface PlantForm extends AdjustForm {
  name: string;
  category: Category;
  goodNeighbors: string[];
  badNeighbors: string[];
  color: string;
  icon: string | null;
}

export type PlantFormErrors = AdjustErrors & { name?: string };

/** Starting colour of the footprint per category; the user can change it. */
export const DEFAULT_COLOR: Record<Category, string> = {
  GEMUESE: '#4f9d4a',
  OBST: '#d9534f',
  KRAUT: '#6a994e',
};

/** The lifecycle choices with an explanation of what they mean in the bed. */
export const LIFECYCLE_OPTIONS: { type: Lifecycle['type']; label: string; hint: string }[] = [
  {
    type: 'ANNUAL',
    label: 'Eine Kultur',
    hint: 'Steht einige Wochen im Beet, z. B. Salat 8 Wochen. Danach endet die Pflanzung von selbst.',
  },
  {
    type: 'MULTI_YEAR',
    label: 'Mehrere Jahre',
    hint: 'Bleibt einige Jahre, z. B. Erdbeeren 3 Jahre, und endet dann.',
  },
  {
    type: 'PERENNIAL',
    label: 'Dauerkultur',
    hint: 'Bleibt, bis du sie aus dem Beet entfernst, z. B. Schnittlauch.',
  },
];

export const EMPTY_PLANT_FORM: PlantForm = {
  name: '',
  category: 'GEMUESE',
  family: '',
  feeder: 'MITTEL',
  spacingInRowCm: '',
  rowSpacingCm: '',
  lifecycleType: 'ANNUAL',
  lifecycleValue: '',
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

/** Checks the form; returns the plant fields or German messages per field. */
export function parsePlantForm(
  form: PlantForm,
): { fields: PlantFields } | { errors: PlantFormErrors } {
  const name = form.name.trim();
  const rest = parseAdjustForm(form);
  if (name === '' || 'errors' in rest) {
    return {
      errors: {
        ...('errors' in rest ? rest.errors : {}),
        ...(name === '' ? { name: 'Bitte gib einen Namen an.' } : {}),
      },
    };
  }
  const { family, feeder, spacingInRowCm, rowSpacingCm, lifecycle } = rest.fields;
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

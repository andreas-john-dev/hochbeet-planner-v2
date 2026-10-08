import type {
  CatalogPlant,
  Category,
  Feeder,
  Lifecycle,
  PlantFields,
  PlantOverride,
} from '@hochbeet/contracts';

export const CATEGORY_LABEL: Record<Category, string> = {
  GEMUESE: 'Gemüse',
  KRAUT: 'Kräuter',
  OBST: 'Obst',
};

export const FEEDER_LABEL: Record<Feeder, string> = {
  STARK: 'Starkzehrer',
  MITTEL: 'Mittelzehrer',
  SCHWACH: 'Schwachzehrer',
};

/** "12 Wochen", "3 Jahre" or "Dauerkultur, ohne Ende". */
export function lifecycleText(lifecycle: Lifecycle): string {
  switch (lifecycle.type) {
    case 'ANNUAL':
      return `${String(lifecycle.cultureWeeks)} ${lifecycle.cultureWeeks === 1 ? 'Woche' : 'Wochen'}`;
    case 'MULTI_YEAR':
      return `${String(lifecycle.years)} ${lifecycle.years === 1 ? 'Jahr' : 'Jahre'}`;
    case 'PERENNIAL':
      return 'Dauerkultur, ohne Ende';
  }
}

export interface CatalogFilter {
  query: string;
  category: Category | null;
  family: string | null;
  feeder: Feeder | null;
}

export const NO_FILTER: CatalogFilter = { query: '', category: null, family: null, feeder: null };

const normalize = (text: string) => text.toLocaleLowerCase('de').trim();

/** Plants matching search and filters, sorted by name. */
export function filterCatalog(plants: readonly CatalogPlant[], filter: CatalogFilter) {
  const q = normalize(filter.query);
  return plants
    .filter(
      (p) =>
        (filter.category === null || p.category === filter.category) &&
        (filter.family === null || p.family === filter.family) &&
        (filter.feeder === null || p.feeder === filter.feeder) &&
        (normalize(p.name).includes(q) || normalize(p.family).includes(q)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** All families of the catalogue, sorted, for the filter. */
export function families(plants: readonly CatalogPlant[]): string[] {
  return [...new Set(plants.map((p) => p.family))].sort((a, b) => a.localeCompare(b, 'de'));
}

const FIELDS = [
  'name',
  'category',
  'family',
  'feeder',
  'spacingInRowCm',
  'rowSpacingCm',
  'lifecycle',
  'goodNeighbors',
  'badNeighbors',
  'color',
  'icon',
] as const satisfies readonly (keyof PlantFields)[];

/** The plant fields without id and catalogue metadata. */
export function plantFields(plant: CatalogPlant): PlantFields {
  return Object.fromEntries(FIELDS.map((key) => [key, plant[key]])) as PlantFields;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Fields where the user's adjustment differs from the global plant. */
export function changedFields(plant: CatalogPlant): Set<keyof PlantFields> {
  const { global } = plant;
  if (!global) return new Set();
  return new Set(FIELDS.filter((key) => !same(plant[key], global[key])));
}

/**
 * The override to store after editing: every field that differs from the global plant.
 * Null means nothing differs any more, so the adjustment can be reset.
 */
export function overrideFor(
  plant: CatalogPlant,
  edited: Partial<PlantFields>,
): PlantOverride | null {
  const base = plant.global ?? plantFields(plant);
  const next = { ...plantFields(plant), ...edited };
  const override = Object.fromEntries(
    FIELDS.filter((key) => !same(next[key], base[key])).map((key) => [key, next[key]]),
  ) as PlantOverride;
  return Object.keys(override).length > 0 ? override : null;
}

/** The values "Für mich anpassen" edits, as form strings. */
export interface AdjustForm {
  family: string;
  feeder: Feeder;
  spacingInRowCm: string;
  rowSpacingCm: string;
  lifecycleType: Lifecycle['type'];
  /** Weeks for annual plants, years for multi-year ones. */
  lifecycleValue: string;
}

export function adjustForm(plant: CatalogPlant): AdjustForm {
  const { lifecycle } = plant;
  return {
    family: plant.family,
    feeder: plant.feeder,
    spacingInRowCm: String(plant.spacingInRowCm),
    rowSpacingCm: String(plant.rowSpacingCm),
    lifecycleType: lifecycle.type,
    lifecycleValue:
      lifecycle.type === 'ANNUAL'
        ? String(lifecycle.cultureWeeks)
        : lifecycle.type === 'MULTI_YEAR'
          ? String(lifecycle.years)
          : '',
  };
}

export type AdjustErrors = Partial<Record<keyof AdjustForm, string>>;

const wholeNumber = (text: string, min: number, max: number) => {
  const value = Number(text.trim());
  return text.trim() !== '' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
};

/** Checks the form; returns the edited plant fields or German messages per field. */
export function parseAdjustForm(
  form: AdjustForm,
): { fields: Partial<PlantFields> } | { errors: AdjustErrors } {
  const errors: AdjustErrors = {};
  const family = form.family.trim();
  if (family === '') errors.family = 'Bitte gib eine Familie an.';
  const spacingInRowCm = wholeNumber(form.spacingInRowCm, 1, 300);
  if (spacingInRowCm === null) errors.spacingInRowCm = 'Bitte 1 bis 300 cm angeben.';
  const rowSpacingCm = wholeNumber(form.rowSpacingCm, 1, 300);
  if (rowSpacingCm === null) errors.rowSpacingCm = 'Bitte 1 bis 300 cm angeben.';
  let lifecycle: Lifecycle | null = { type: 'PERENNIAL' };
  if (form.lifecycleType === 'ANNUAL') {
    const cultureWeeks = wholeNumber(form.lifecycleValue, 1, 104);
    lifecycle = cultureWeeks === null ? null : { type: 'ANNUAL', cultureWeeks };
    if (!lifecycle) errors.lifecycleValue = 'Bitte 1 bis 104 Wochen angeben.';
  } else if (form.lifecycleType === 'MULTI_YEAR') {
    const years = wholeNumber(form.lifecycleValue, 1, 20);
    lifecycle = years === null ? null : { type: 'MULTI_YEAR', years };
    if (!lifecycle) errors.lifecycleValue = 'Bitte 1 bis 20 Jahre angeben.';
  }
  if (spacingInRowCm === null || rowSpacingCm === null || lifecycle === null || family === '') {
    return { errors };
  }
  return {
    fields: { family, feeder: form.feeder, spacingInRowCm, rowSpacingCm, lifecycle },
  };
}

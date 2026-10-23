import {
  type PlantFields,
  type Sowing,
  type SowingMethod,
  SowingSchema,
} from '@hochbeet/contracts';

/** Form values of "Aussaat & Anzucht"; numbers as typed, `method: null` = no details. */
export interface SowingForm {
  frostSensitive: boolean;
  method: SowingMethod | null;
  presowFrom: string;
  presowTo: string;
  propagationMin: string;
  propagationMax: string;
  prickOutWeeks: string;
  directFrom: string;
  directTo: string;
  directSowExtraWeeks: string;
  germinationDaysMin: string;
  germinationDaysMax: string;
  germinationTempMin: string;
  germinationTempMax: string;
}

export type SowingErrors = Partial<Record<keyof SowingForm, string>>;
export type SowingFields = Pick<PlantFields, 'frostSensitive' | 'sowing'>;

export const EMPTY_SOWING_FORM: SowingForm = {
  frostSensitive: false,
  method: null,
  presowFrom: '',
  presowTo: '',
  propagationMin: '',
  propagationMax: '',
  prickOutWeeks: '',
  directFrom: '',
  directTo: '',
  directSowExtraWeeks: '',
  germinationDaysMin: '',
  germinationDaysMax: '',
  germinationTempMin: '',
  germinationTempMax: '',
};

const text = (value: number | undefined) => (value === undefined ? '' : String(value));

export function sowingForm({ frostSensitive, sowing }: SowingFields): SowingForm {
  return {
    frostSensitive: frostSensitive ?? false,
    method: sowing?.method ?? null,
    presowFrom: text(sowing?.presowWeeks?.from),
    presowTo: text(sowing?.presowWeeks?.to),
    propagationMin: text(sowing?.propagationWeeks?.min),
    propagationMax: text(sowing?.propagationWeeks?.max),
    prickOutWeeks: text(sowing?.prickOutWeeks),
    directFrom: text(sowing?.directSowWeeks?.from),
    directTo: text(sowing?.directSowWeeks?.to),
    directSowExtraWeeks: text(sowing?.directSowExtraWeeks),
    germinationDaysMin: text(sowing?.germinationDays?.min),
    germinationDaysMax: text(sowing?.germinationDays?.max),
    germinationTempMin: text(sowing?.germinationTempC?.min),
    germinationTempMax: text(sowing?.germinationTempC?.max),
  };
}

type NumberKey = Exclude<keyof SowingForm, 'frostSensitive' | 'method'>;

/** Pairs of form fields stored as one object, keyed by the schema field. */
const PAIRS = {
  presowWeeks: ['presowFrom', 'presowTo', 'from', 'to'],
  propagationWeeks: ['propagationMin', 'propagationMax', 'min', 'max'],
  directSowWeeks: ['directFrom', 'directTo', 'from', 'to'],
  germinationDays: ['germinationDaysMin', 'germinationDaysMax', 'min', 'max'],
  germinationTempC: ['germinationTempMin', 'germinationTempMax', 'min', 'max'],
} as const satisfies Record<string, readonly [NumberKey, NumberKey, string, string]>;

type Pair = (typeof PAIRS)[keyof typeof PAIRS];

const SINGLES = ['prickOutWeeks', 'directSowExtraWeeks'] as const satisfies readonly NumberKey[];

const PRESOW_KEYS: readonly NumberKey[] = [
  'presowFrom',
  'presowTo',
  'propagationMin',
  'propagationMax',
  'prickOutWeeks',
];
const DIRECT_KEYS: readonly NumberKey[] = ['directFrom', 'directTo', 'directSowExtraWeeks'];

/** Fields that belong to the chosen method; the others are ignored and not stored. */
export function usesField(method: SowingMethod | null, key: NumberKey): boolean {
  if (method === null) return false;
  if (PRESOW_KEYS.includes(key)) return method !== 'DIRECT';
  if (DIRECT_KEYS.includes(key)) return method !== 'PRESOW';
  return true;
}

/**
 * Checks the form; returns frost sensitivity and sowing details or German messages per field.
 * Both keys are always set: `frostSensitive` as boolean so that an adjustment can switch it
 * off again, `sowing` as undefined when there are no details.
 */
export function parseSowingForm(
  form: SowingForm,
): { fields: { frostSensitive: boolean; sowing: Sowing | undefined } } | { errors: SowingErrors } {
  if (form.method === null) {
    return { fields: { frostSensitive: form.frostSensitive, sowing: undefined } };
  }
  const method = form.method;
  const errors: SowingErrors = {};
  const numbers: Partial<Record<NumberKey, number>> = {};
  for (const key of Object.keys(form) as (keyof SowingForm)[]) {
    if (key === 'frostSensitive' || key === 'method' || !usesField(method, key)) continue;
    const value = form[key].trim();
    if (value === '') continue;
    const number = Number(value);
    if (Number.isInteger(number)) numbers[key] = number;
    else errors[key] = 'Bitte eine ganze Zahl angeben.';
  }

  const sowing: Record<string, unknown> = { method };
  for (const [field, [fromKey, toKey, fromName, toName]] of Object.entries(PAIRS)) {
    const from = numbers[fromKey];
    const to = numbers[toKey];
    if (from !== undefined && to !== undefined) sowing[field] = { [fromName]: from, [toName]: to };
    else if (from !== undefined && !errors[toKey]) errors[toKey] = 'Bitte beide Werte angeben.';
    else if (to !== undefined && !errors[fromKey]) errors[fromKey] = 'Bitte beide Werte angeben.';
  }
  for (const key of SINGLES) {
    if (numbers[key] !== undefined) sowing[key] = numbers[key];
  }

  const parsed = SowingSchema.safeParse(sowing);
  for (const issue of parsed.error?.issues ?? []) {
    // A missing pair that is half filled already has "Bitte beide Werte angeben."
    const pair = PAIRS[issue.path[0] as keyof typeof PAIRS] as Pair | undefined;
    if (issue.path.length === 1 && pair && (errors[pair[0]] || errors[pair[1]])) continue;
    const key = formKey(issue.path);
    if (key && !errors[key]) errors[key] = issue.message;
  }
  if (Object.keys(errors).length > 0 || !parsed.success) return { errors };
  return { fields: { frostSensitive: form.frostSensitive, sowing: parsed.data } };
}

/** The form field a schema issue belongs to, e.g. `propagationWeeks.max` → `propagationMax`. */
function formKey(path: readonly PropertyKey[]): NumberKey | undefined {
  const [field, part] = path;
  if (field === 'prickOutWeeks' || field === 'directSowExtraWeeks') return field;
  const pair = PAIRS[field as keyof typeof PAIRS] as Pair | undefined;
  if (!pair) return undefined;
  return part === pair[3] ? pair[1] : pair[0];
}

/** The messages left after editing: a field's message goes away as soon as it is edited. */
export function remainingErrors(
  errors: SowingErrors | undefined,
  change: Partial<SowingForm>,
): SowingErrors {
  return Object.fromEntries(Object.entries(errors ?? {}).filter(([key]) => !(key in change)));
}

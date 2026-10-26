import { z } from 'zod';
import {
  DirectionSchema,
  GridCmSchema,
  IsoDateSchema,
  MondaySchema,
  UlidSchema,
  WeekWindowSchema,
} from './primitives';

const NameSchema = z.string().trim().min(1, 'Bitte einen Namen angeben.').max(60);

/** Positive grid length, e.g. bed size or row length. */
export const PositiveGridCmSchema = GridCmSchema.min(5, 'Mindestens 5 cm.');

// ---------------------------------------------------------------------------
// Bed
// ---------------------------------------------------------------------------

export const BedFieldsSchema = z.object({
  name: NameSchema,
  widthCm: PositiveGridCmSchema.max(2000),
  depthCm: PositiveGridCmSchema.max(2000),
  mainRowDirection: DirectionSchema,
  /** Dates the soil was renewed; each resets crop rotation. Default: 1 March every year. */
  soilRenewals: z
    .array(IsoDateSchema)
    .refine((dates) => new Set(dates).size === dates.length, 'Datum doppelt.'),
});

export const BedSchema = BedFieldsSchema.extend({ id: UlidSchema });
export type BedFields = z.infer<typeof BedFieldsSchema>;
export type Bed = z.infer<typeof BedSchema>;

// ---------------------------------------------------------------------------
// Planting
// ---------------------------------------------------------------------------

/** `DIRECT_SOW` = sown into the bed, `TRANSPLANT` = planted out as a seedling. */
export const PlantingOriginSchema = z.enum(['DIRECT_SOW', 'TRANSPLANT']);
export type PlantingOrigin = z.infer<typeof PlantingOriginSchema>;

const PlantingBaseSchema = z.object({
  plantId: UlidSchema,
  /**
   * How the planting got into the bed; direct sowing may stay longer (`directSowExtraWeeks`).
   * Missing in data written before it existed, which counts as planted out.
   */
  origin: PlantingOriginSchema.default('TRANSPLANT'),
  /** Position in cm on the grid; for rows the start point. */
  x: GridCmSchema,
  y: GridCmSchema,
  /** Always the Monday of the chosen week. */
  startDate: MondaySchema,
  /** Prefilled from the lifecycle, can be changed; null for perennials. */
  endDate: IsoDateSchema.nullable(),
  /** Manual removal from this Monday on; takes precedence over endDate. */
  removedDate: MondaySchema.nullable(),
});

const SinglePlantingFieldsSchema = PlantingBaseSchema.extend({ kind: z.literal('SINGLE') });

const RowPlantingFieldsSchema = PlantingBaseSchema.extend({
  kind: z.literal('ROW'),
  orientation: DirectionSchema,
  lengthCm: PositiveGridCmSchema,
});

function checkDates(
  planting: { startDate: string; endDate: string | null; removedDate: string | null },
  ctx: z.RefinementCtx,
) {
  if (planting.endDate !== null && planting.endDate <= planting.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'Ende muss nach dem Start liegen.',
    });
  }
  if (planting.removedDate !== null && planting.removedDate < planting.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['removedDate'],
      message: 'Entfernen darf nicht vor dem Start liegen.',
    });
  }
}

/** Planting without id and bedId, as sent when creating or updating one. */
export const PlantingFieldsSchema = z
  .discriminatedUnion('kind', [SinglePlantingFieldsSchema, RowPlantingFieldsSchema])
  .superRefine(checkDates);

const ids = { id: UlidSchema, bedId: UlidSchema };

export const PlantingSchema = z
  .discriminatedUnion('kind', [
    SinglePlantingFieldsSchema.extend(ids),
    RowPlantingFieldsSchema.extend(ids),
  ])
  .superRefine(checkDates);

export type PlantingFields = z.infer<typeof PlantingFieldsSchema>;
export type Planting = z.infer<typeof PlantingSchema>;
export type SinglePlanting = Extract<Planting, { kind: 'SINGLE' }>;
export type RowPlanting = Extract<Planting, { kind: 'ROW' }>;

// ---------------------------------------------------------------------------
// Plant
// ---------------------------------------------------------------------------

export const CategorySchema = z.enum(['GEMUESE', 'OBST', 'KRAUT']);
export const FeederSchema = z.enum(['STARK', 'MITTEL', 'SCHWACH']);
export type Category = z.infer<typeof CategorySchema>;
export type Feeder = z.infer<typeof FeederSchema>;

/** How long a plant stays in the bed. */
export const LifecycleSchema = z.discriminatedUnion('type', [
  /** End = planting date + culture weeks. */
  z.object({ type: z.literal('ANNUAL'), cultureWeeks: z.number().int().min(1).max(104) }),
  /** End = planting date + years, e.g. strawberries with 3 years. */
  z.object({ type: z.literal('MULTI_YEAR'), years: z.number().int().min(1).max(20) }),
  /** No end; only manual removal. */
  z.object({ type: z.literal('PERENNIAL') }),
]);
export type Lifecycle = z.infer<typeof LifecycleSchema>;

/** Spacing in cm. Not bound to the grid: sources give values like 7 cm. */
const SpacingCmSchema = z.number().int().min(1).max(300);

/** `DIRECT` = sown into the bed, `PRESOW` = raised as seedlings first, `BOTH` = either way. */
export const SowingMethodSchema = z.enum(['DIRECT', 'PRESOW', 'BOTH']);
export type SowingMethod = z.infer<typeof SowingMethodSchema>;

/** Whole number from `min` to `max` with a German message. */
const intBetween = (min: number, max: number, unit: string) =>
  z
    .number()
    .int(`Ganze ${unit} angeben.`)
    .min(min, `${String(min)} bis ${String(max)} ${unit} angeben.`)
    .max(max, `${String(min)} bis ${String(max)} ${unit} angeben.`);

/** Range with `min <= max`, e.g. 6–8 weeks. */
const rangeOf = (value: z.ZodNumber) =>
  z.object({ min: value, max: value }).refine((range) => range.min <= range.max, {
    path: ['max'],
    message: 'Bis-Wert muss mindestens so groß sein wie der Von-Wert.',
  });

const PRESOW_ONLY = ['presowWeeks', 'propagationWeeks', 'prickOutWeeks'] as const;
const DIRECT_ONLY = ['directSowWeeks', 'directSowExtraWeeks'] as const;

/**
 * How a plant is sown or raised. Windows are ISO weeks like on the back of a seed packet;
 * the lifecycle counts from the day the plant goes into the bed, so direct sowing may add
 * `directSowExtraWeeks` for germination and the first weeks.
 */
export const SowingSchema = z
  .object({
    method: SowingMethodSchema,
    /** When seedlings can be started indoors; required for PRESOW and BOTH. */
    presowWeeks: WeekWindowSchema.optional(),
    /** Weeks from sowing to planting out; required for PRESOW and BOTH. */
    propagationWeeks: rangeOf(intBetween(1, 26, 'Wochen')).optional(),
    /** Pricking out after this many weeks. */
    prickOutWeeks: intBetween(1, 12, 'Wochen').optional(),
    /** When it can be sown into the bed; required for DIRECT and BOTH. */
    directSowWeeks: WeekWindowSchema.optional(),
    /** Added to the lifecycle of direct sown plantings; missing means 0. */
    directSowExtraWeeks: intBetween(0, 26, 'Wochen').optional(),
    germinationDays: rangeOf(intBetween(1, 60, 'Tage')).optional(),
    germinationTempC: rangeOf(intBetween(0, 40, '°C')).optional(),
  })
  .superRefine((sowing, ctx) => {
    const presow = sowing.method !== 'DIRECT';
    const direct = sowing.method !== 'PRESOW';
    const required = (key: keyof typeof sowing, message: string) => {
      if (sowing[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message });
    };
    const forbidden = (keys: readonly (keyof typeof sowing)[], message: string) => {
      for (const key of keys) {
        if (sowing[key] !== undefined) ctx.addIssue({ code: 'custom', path: [key], message });
      }
    };
    if (presow) {
      required('presowWeeks', 'Bitte die Wochen für die Vorkultur angeben.');
      required('propagationWeeks', 'Bitte die Dauer der Vorkultur angeben.');
    } else {
      forbidden(PRESOW_ONLY, 'Nur bei Vorkultur möglich.');
    }
    if (direct) {
      required('directSowWeeks', 'Bitte die Wochen für die Direktsaat angeben.');
    } else {
      forbidden(DIRECT_ONLY, 'Nur bei Direktsaat möglich.');
    }
  });
export type Sowing = z.infer<typeof SowingSchema>;

export const PlantFieldsSchema = z.object({
  name: NameSchema,
  category: CategorySchema,
  /** Plant family, e.g. Kreuzblütler; basis of crop rotation. */
  family: NameSchema,
  feeder: FeederSchema,
  spacingInRowCm: SpacingCmSchema,
  rowSpacingCm: SpacingCmSchema,
  lifecycle: LifecycleSchema,
  goodNeighbors: z.array(UlidSchema),
  badNeighbors: z.array(UlidSchema),
  /** Colour of the footprint in the bed editor. */
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Farbe als #rrggbb erwartet.'),
  /** Key of an icon in packages/plant-icons. */
  icon: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Unbekanntes Icon.'),
  /** Does not stand frost: goes outside only after the last frost. Missing means false. */
  frostSensitive: z.boolean().optional(),
  /** Sowing and raising; missing for plants without these details. */
  sowing: SowingSchema.optional(),
});

export const PlantSchema = PlantFieldsSchema.extend({ id: UlidSchema });
export type PlantFields = z.infer<typeof PlantFieldsSchema>;
export type Plant = z.infer<typeof PlantSchema>;

/** Personal adjustment of a global plant: effective plant = { ...global, ...override }. */
export const PlantOverrideSchema = PlantFieldsSchema.partial()
  .strict()
  .refine((override) => Object.keys(override).length > 0, 'Keine Änderung angegeben.');
export type PlantOverride = z.infer<typeof PlantOverrideSchema>;

export const PublicationStatusSchema = z.enum(['PRIVATE', 'PENDING', 'PUBLISHED']);
export type PublicationStatus = z.infer<typeof PublicationStatusSchema>;

/** A plant as the user sees it: global (possibly adjusted) or own. */
export const CatalogPlantSchema = PlantSchema.extend({
  source: z.enum(['GLOBAL', 'OWN']),
  /** True when the user has a personal adjustment of this global plant. */
  overridden: z.boolean(),
  /**
   * The unchanged global values, only for adjusted global plants: the UI marks what differs
   * and computes the next override against them.
   */
  global: PlantFieldsSchema.optional(),
  /** Only for own plants. */
  publication: z
    .object({
      status: PublicationStatusSchema,
      /** Admin comment of the last rejection. */
      rejectionComment: z.string().optional(),
    })
    .optional(),
});
export type CatalogPlant = z.infer<typeof CatalogPlantSchema>;

import { z } from 'zod';
import {
  DirectionSchema,
  GridCmSchema,
  IsoDateSchema,
  MondaySchema,
  UlidSchema,
} from './primitives';

const NameSchema = z.string().trim().min(1, 'Bitte einen Namen angeben.').max(60);

/** Positive grid length, e.g. bed size or row length. */
const PositiveGridCmSchema = GridCmSchema.min(5, 'Mindestens 5 cm.');

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

const PlantingBaseSchema = z.object({
  plantId: UlidSchema,
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

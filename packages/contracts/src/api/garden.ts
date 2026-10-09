import { z } from 'zod';
import { BedFieldsSchema, BedSchema, PlantingFieldsSchema, PlantingSchema } from '../domain';
import { UlidSchema } from '../primitives';

// Garden-Service, routes under /api/garden (docs/architecture.md, "Garden-Service").

/** POST /garden/beds, PUT /garden/beds/{bedId} */
export const SaveBedRequestSchema = BedFieldsSchema;
export type SaveBedRequest = z.infer<typeof SaveBedRequestSchema>;

/** GET /garden/beds */
export const ListBedsResponseSchema = z.object({ beds: z.array(BedSchema) });
export type ListBedsResponse = z.infer<typeof ListBedsResponseSchema>;

/** GET /garden/beds/{bedId}: the bed with all plantings over all time. */
export const BedWithPlantingsResponseSchema = z.object({
  bed: BedSchema,
  plantings: z.array(PlantingSchema),
});
export type BedWithPlantingsResponse = z.infer<typeof BedWithPlantingsResponseSchema>;

/** POST /garden/beds/{bedId}/plantings, PUT /garden/beds/{bedId}/plantings/{id} */
export const SavePlantingRequestSchema = PlantingFieldsSchema;
export type SavePlantingRequest = z.infer<typeof SavePlantingRequestSchema>;

/** Most beds and plantings one import may carry; more than any guest plans in a browser. */
export const MAX_IMPORT_BEDS = 50;
export const MAX_IMPORT_PLANTINGS = 1000;

/**
 * POST /garden/import: a guest's beds and plantings from the browser, after sign-in. The
 * service gives everything new ids and maps the plantings to the new beds. `importId` makes
 * the call idempotent: repeating it with the same id writes nothing twice. Plant ids of the
 * plantings must already point to the user's catalogue (see POST /catalog/import).
 */
export const ImportGardenRequestSchema = z
  .object({
    importId: UlidSchema,
    beds: z
      .array(BedSchema)
      .max(MAX_IMPORT_BEDS, `Höchstens ${String(MAX_IMPORT_BEDS)} Beete auf einmal.`),
    plantings: z
      .array(PlantingSchema)
      .max(
        MAX_IMPORT_PLANTINGS,
        `Höchstens ${String(MAX_IMPORT_PLANTINGS)} Pflanzungen auf einmal.`,
      ),
  })
  .superRefine(({ beds, plantings }, ctx) => {
    const bedIds = new Set(beds.map((b) => b.id));
    if (bedIds.size !== beds.length) {
      ctx.addIssue({ code: 'custom', path: ['beds'], message: 'Beet doppelt.' });
    }
    plantings.forEach((planting, index) => {
      if (!bedIds.has(planting.bedId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['plantings', index, 'bedId'],
          message: 'Dieses Beet fehlt im Import.',
        });
      }
    });
  });
export type ImportGardenRequest = z.infer<typeof ImportGardenRequestSchema>;

/** Response of POST /garden/import: new bed id per imported bed id. */
export const ImportGardenResponseSchema = z.object({ bedIds: z.record(UlidSchema, UlidSchema) });
export type ImportGardenResponse = z.infer<typeof ImportGardenResponseSchema>;

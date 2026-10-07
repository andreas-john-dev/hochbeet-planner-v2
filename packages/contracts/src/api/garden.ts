import { z } from 'zod';
import { BedFieldsSchema, BedSchema, PlantingFieldsSchema, PlantingSchema } from '../domain';

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

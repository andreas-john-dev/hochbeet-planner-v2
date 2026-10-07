import { z } from 'zod';
import { CatalogPlantSchema, PlantFieldsSchema, PlantOverrideSchema, PlantSchema } from '../domain';
import { IsoDateSchema } from '../primitives';

// Catalog-Service, routes under /api/catalog (docs/architecture.md, "Catalog-Service").

/** GET /catalog/plants: the user's effective view (global + adjustments + own). */
export const ListPlantsResponseSchema = z.object({ plants: z.array(CatalogPlantSchema) });
export type ListPlantsResponse = z.infer<typeof ListPlantsResponseSchema>;

/** POST /catalog/plants, PUT /catalog/plants/{id}, POST/PUT /catalog/admin/plants[/{id}] */
export const SavePlantRequestSchema = PlantFieldsSchema;
export type SavePlantRequest = z.infer<typeof SavePlantRequestSchema>;

/** PUT /catalog/plants/{id}/override */
export const SaveOverrideRequestSchema = PlantOverrideSchema;
export type SaveOverrideRequest = z.infer<typeof SaveOverrideRequestSchema>;

/** GET /catalog/admin/publications: the admin queue. */
export const PublicationQueueResponseSchema = z.object({
  requests: z.array(
    z.object({
      plant: PlantSchema,
      /** User who asked for publication (`sub`). */
      requestedBy: z.string(),
      requestedAt: IsoDateSchema,
    }),
  ),
});
export type PublicationQueueResponse = z.infer<typeof PublicationQueueResponseSchema>;

/** POST /catalog/admin/publications/{id}/approve: optional corrections before publishing. */
export const ApprovePublicationRequestSchema = z.object({
  corrections: PlantFieldsSchema.partial().strict().optional(),
});
export type ApprovePublicationRequest = z.infer<typeof ApprovePublicationRequestSchema>;

/** POST /catalog/admin/publications/{id}/reject */
export const RejectPublicationRequestSchema = z.object({
  comment: z.string().trim().min(1, 'Bitte begründe die Ablehnung.').max(500),
});
export type RejectPublicationRequest = z.infer<typeof RejectPublicationRequestSchema>;

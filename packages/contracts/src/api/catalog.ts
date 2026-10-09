import { z } from 'zod';
import { CatalogPlantSchema, PlantFieldsSchema, PlantOverrideSchema, PlantSchema } from '../domain';
import { IsoDateSchema, UlidSchema } from '../primitives';

// Catalog-Service, routes under /api/catalog (docs/architecture.md, "Catalog-Service").

/** GET /catalog/plants: the user's effective view (global + adjustments + own). */
export const ListPlantsResponseSchema = z.object({ plants: z.array(CatalogPlantSchema) });
export type ListPlantsResponse = z.infer<typeof ListPlantsResponseSchema>;

/**
 * GET /catalog/public/plants: the global catalogue without sign-in (guests), without any
 * user's adjustments or own plants. Cached by CloudFront for a few minutes.
 */
export const ListPublicPlantsResponseSchema = z.object({ plants: z.array(PlantSchema) });
export type ListPublicPlantsResponse = z.infer<typeof ListPublicPlantsResponseSchema>;

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

/** Most own plants and adjustments one import may carry. */
export const MAX_IMPORT_PLANTS = 200;

/**
 * POST /catalog/import: a guest's own plants and adjustments from the browser, after sign-in.
 * Own plants get new ids and stay private; neighbours are mapped to the new ids, and those
 * the user's catalogue does not know are dropped. Adjustments of unknown plants are skipped,
 * and an adjustment the user already has wins over the imported one. Idempotent per
 * `importId`, like POST /garden/import.
 */
export const ImportCatalogRequestSchema = z.object({
  importId: UlidSchema,
  ownPlants: z
    .array(PlantSchema.extend({ archived: z.boolean().optional() }))
    .max(MAX_IMPORT_PLANTS, `Höchstens ${String(MAX_IMPORT_PLANTS)} eigene Sorten auf einmal.`),
  overrides: z
    .array(z.object({ plantId: UlidSchema, fields: PlantOverrideSchema }))
    .max(MAX_IMPORT_PLANTS, `Höchstens ${String(MAX_IMPORT_PLANTS)} Anpassungen auf einmal.`),
});
export type ImportCatalogRequest = z.infer<typeof ImportCatalogRequestSchema>;

/** Response of POST /catalog/import: new plant id per imported own plant id. */
export const ImportCatalogResponseSchema = z.object({
  plantIds: z.record(UlidSchema, UlidSchema),
});
export type ImportCatalogResponse = z.infer<typeof ImportCatalogResponseSchema>;

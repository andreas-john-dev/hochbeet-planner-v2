import {
  type CatalogPlant,
  type Plant,
  type PlantOverride,
  PlantOverrideSchema,
  PlantSchema,
  type PublicationStatus,
  PublicationStatusSchema,
} from '@hochbeet/contracts';
import { z } from 'zod';

/** Own plant as stored: plant fields plus publication state; archived plants stay hidden. */
export const OwnPlantItemSchema = PlantSchema.extend({
  publicationStatus: PublicationStatusSchema.default('PRIVATE'),
  rejectionComment: z.string().optional(),
  /** ISO timestamp of the publication request while the plant is PENDING. */
  requestedAt: z.string().optional(),
  archived: z.boolean().default(false),
});
export type OwnPlantItem = z.infer<typeof OwnPlantItemSchema>;

/** Stored override: the changed fields of a global plant. */
export const OverrideItemSchema = z.object({
  plantId: z.string(),
  fields: PlantOverrideSchema,
});
export type OverrideItem = z.infer<typeof OverrideItemSchema>;

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'de');

/**
 * The user's effective catalogue: every global plant with the user's override applied
 * (`{ ...global, ...override }`), plus the user's own plants that are not archived.
 * Published own plants are global now and appear only once, as global plants.
 */
export function effectiveCatalog(
  globals: readonly Plant[],
  overrides: readonly OverrideItem[],
  own: readonly OwnPlantItem[],
): CatalogPlant[] {
  const overrideOf = new Map<string, PlantOverride>(overrides.map((o) => [o.plantId, o.fields]));
  const globalPlants = globals.map((plant): CatalogPlant => {
    const override = overrideOf.get(plant.id);
    return { ...plant, ...override, id: plant.id, source: 'GLOBAL', overridden: !!override };
  });
  const ownPlants = own
    .filter((item) => !item.archived && item.publicationStatus !== 'PUBLISHED')
    .map(
      ({
        publicationStatus,
        rejectionComment,
        requestedAt: _requestedAt,
        archived: _archived,
        ...plant
      }): CatalogPlant => ({
        ...plant,
        source: 'OWN',
        overridden: false,
        publication: publication(publicationStatus, rejectionComment),
      }),
    );
  return [...globalPlants, ...ownPlants].sort(byName);
}

function publication(status: PublicationStatus, rejectionComment: string | undefined) {
  return rejectionComment === undefined ? { status } : { status, rejectionComment };
}

import type { CatalogPlant } from '@hochbeet/contracts';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, SearchX } from 'lucide-react';
import { PlantFormFields } from '@/components/catalog/PlantFormFields';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { SkeletonList } from '@/components/ui/skeleton';
import { usePlants, useSaveOwnPlant } from '@/lib/garden';
import { EMPTY_PLANT_FORM, plantForm } from '@/lib/plant-form';

/** Route component for /katalog/neu and /katalog/$plantId/bearbeiten. */
export function PlantFormPage() {
  const plantId = plantIdParam(useParams({ strict: false }));
  const plants = usePlants();
  const plant = plantId ? plants.data?.find((p) => p.id === plantId) : undefined;

  return (
    <>
      <Link
        to={plantId ? '/katalog/$plantId' : '/katalog'}
        params={plantId ? { plantId } : undefined}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {plantId ? 'Zurück zur Sorte' : 'Katalog'}
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight md:text-3xl">
        {plantId ? 'Sorte bearbeiten' : 'Eigene Sorte anlegen'}
      </h1>
      {plants.isError ? (
        <FormMessage tone="error">
          Der Katalog konnte nicht geladen werden. Bitte lade die Seite neu.
        </FormMessage>
      ) : plants.isPending ? (
        <SkeletonList
          label="Katalog wird geladen …"
          count={5}
          className="flex max-w-2xl flex-col gap-4"
          itemClassName="h-11"
        />
      ) : plantId && plant?.source !== 'OWN' ? (
        <EmptyState icon={SearchX} title="Keine eigene Sorte">
          Bearbeiten lassen sich nur deine eigenen Sorten. Globale Sorten passt du auf ihrer Seite
          für dich an.
        </EmptyState>
      ) : (
        <OwnPlantForm key={plantId} plant={plant} catalog={plants.data} />
      )}
    </>
  );
}

// Params are untyped here: typing them via the route would make router.tsx circular.
function plantIdParam(params: unknown): string | undefined {
  const value = (params as { plantId?: unknown } | null)?.plantId;
  return typeof value === 'string' ? value : undefined;
}

function OwnPlantForm({
  plant,
  catalog,
}: {
  plant: CatalogPlant | undefined;
  catalog: readonly CatalogPlant[];
}) {
  const navigate = useNavigate();
  const save = useSaveOwnPlant();
  const toDetails = (plantId: string) => navigate({ to: '/katalog/$plantId', params: { plantId } });
  return (
    <PlantFormFields
      initial={plant ? plantForm(plant) : EMPTY_PLANT_FORM}
      catalog={catalog}
      neighborCandidates={catalog.filter((p) => p.id !== plant?.id)}
      submitLabel={plant ? 'Speichern' : 'Sorte anlegen'}
      pending={save.isPending}
      error={save.error}
      onSubmit={async (fields) => {
        const saved = await save.mutateAsync({ id: plant?.id, fields });
        await toDetails(saved.id);
      }}
      onCancel={() => {
        void (plant ? toDetails(plant.id) : navigate({ to: '/katalog' }));
      }}
    />
  );
}

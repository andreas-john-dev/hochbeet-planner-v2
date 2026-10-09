import type { CatalogPlant } from '@hochbeet/contracts';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, SearchX } from 'lucide-react';
import { PlantFormFields } from '@/components/catalog/PlantFormFields';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { SkeletonList } from '@/components/ui/skeleton';
import { globalValues } from '@/lib/admin';
import { usePlants, useSaveGlobalPlant } from '@/lib/garden';
import { EMPTY_PLANT_FORM, plantForm } from '@/lib/plant-form';

/** Route component for /admin/sorten/neu and /admin/sorten/$plantId. */
export function GlobalPlantFormPage() {
  const plantId = plantIdParam(useParams({ strict: false }));
  const plants = usePlants();
  const plant = plantId ? plants.data?.find((p) => p.id === plantId) : undefined;

  return (
    <>
      <Link
        to="/admin"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Administration
      </Link>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight md:text-3xl">
        {plantId ? 'Globale Sorte bearbeiten' : 'Globale Sorte anlegen'}
      </h1>
      <p className="text-muted-foreground mb-6">
        Gilt für alle. Persönliche Anpassungen der Nutzer bleiben bestehen.
      </p>
      {plants.isError ? (
        <FormMessage tone="error">Der Katalog konnte nicht geladen werden.</FormMessage>
      ) : plants.isPending ? (
        <SkeletonList
          label="Katalog wird geladen …"
          count={5}
          className="flex max-w-2xl flex-col gap-4"
          itemClassName="h-11"
        />
      ) : plantId && plant?.source !== 'GLOBAL' ? (
        <EmptyState icon={SearchX} title="Keine globale Sorte">
          Diese Sorte gibt es nicht im globalen Katalog.
        </EmptyState>
      ) : (
        <GlobalPlantForm key={plantId} plant={plant} catalog={plants.data} />
      )}
    </>
  );
}

// Params are untyped here: typing them via the route would make router.tsx circular.
function plantIdParam(params: unknown): string | undefined {
  const value = (params as { plantId?: unknown } | null)?.plantId;
  return typeof value === 'string' ? value : undefined;
}

function GlobalPlantForm({
  plant,
  catalog,
}: {
  plant: CatalogPlant | undefined;
  catalog: readonly CatalogPlant[];
}) {
  const navigate = useNavigate();
  const save = useSaveGlobalPlant();
  const toAdmin = () => navigate({ to: '/admin' });
  return (
    <PlantFormFields
      initial={plant ? plantForm(globalValues(plant)) : EMPTY_PLANT_FORM}
      catalog={catalog}
      // Global plants may only point to global plants.
      neighborCandidates={catalog.filter((p) => p.source === 'GLOBAL' && p.id !== plant?.id)}
      submitLabel={plant ? 'Speichern' : 'Sorte anlegen'}
      pending={save.isPending}
      error={save.error}
      onSubmit={async (fields) => {
        await save.mutateAsync({ id: plant?.id, fields });
        await toAdmin();
      }}
      onCancel={() => {
        void toAdmin();
      }}
    />
  );
}

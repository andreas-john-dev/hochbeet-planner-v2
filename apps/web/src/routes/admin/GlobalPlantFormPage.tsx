import type { CatalogPlant } from '@hochbeet/contracts';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlantFormFields } from '@/components/catalog/PlantFormFields';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { SkeletonList } from '@/components/ui/skeleton';
import { globalValues } from '@/lib/admin';
import { usePlants, useSaveGlobalPlant } from '@/lib/garden';
import { EMPTY_PLANT_FORM, plantForm } from '@/lib/plant-form';

/** Route component for /admin/sorten/neu and /admin/sorten/$plantId. */
export function GlobalPlantFormPage() {
  const { t } = useTranslation(['admin', 'catalog']);
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
        {t('title')}
      </Link>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight md:text-3xl">
        {plantId ? t('globals.edit') : t('globals.create')}
      </h1>
      <p className="text-muted-foreground mb-6">{t('globals.appliesToAll')}</p>
      {plants.isError ? (
        <FormMessage tone="error">{t('globals.loadError')}</FormMessage>
      ) : plants.isPending ? (
        <SkeletonList
          label={t('catalog:loading')}
          count={5}
          className="flex max-w-2xl flex-col gap-4"
          itemClassName="h-11"
        />
      ) : plantId && plant?.source !== 'GLOBAL' ? (
        <EmptyState icon={SearchX} title={t('globals.notGlobal')}>
          {t('globals.notGlobalText')}
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
  const { t } = useTranslation(['catalog', 'common']);
  const navigate = useNavigate();
  const save = useSaveGlobalPlant();
  const toAdmin = () => navigate({ to: '/admin' });
  return (
    <PlantFormFields
      initial={plant ? plantForm(globalValues(plant)) : EMPTY_PLANT_FORM}
      catalog={catalog}
      // Global plants may only point to global plants.
      neighborCandidates={catalog.filter((p) => p.source === 'GLOBAL' && p.id !== plant?.id)}
      submitLabel={plant ? t('common:save') : t('form.submitCreate')}
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

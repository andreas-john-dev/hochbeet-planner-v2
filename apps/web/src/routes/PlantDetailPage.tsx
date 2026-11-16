import type { CatalogPlant, PlantFields } from '@hochbeet/contracts';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Pencil, RotateCcw, SearchX, SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdjustPlantDialog } from '@/components/catalog/AdjustPlantDialog';
import { PublicationPanel } from '@/components/catalog/PublicationPanel';
import { SourceBadge } from '@/components/catalog/SourceBadge';
import { SowingCalendar } from '@/components/catalog/SowingCalendar';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api';
import { changedFields, lifecycleText } from '@/lib/catalog';
import { useAdjustPlant, usePlants } from '@/lib/garden';
import { useLanguage } from '@/lib/i18n';
import { byPlantName, familyName, plantName } from '@/lib/plant-names';
import { sowingLines } from '@/lib/sowing';
import { cn } from '@/lib/utils';

/** Route component for /katalog/$plantId. */
export function PlantDetailPage() {
  const { t } = useTranslation('catalog');
  const plantId = plantIdParam(useParams({ strict: false }));
  const plants = usePlants();
  const plant = plants.data?.find((p) => p.id === plantId);

  return (
    <>
      <Link
        to="/katalog"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('back')}
      </Link>
      {plants.isError ? (
        <FormMessage tone="error">{t('loadError')}</FormMessage>
      ) : plants.isPending ? (
        <PlantDetailSkeleton />
      ) : plant ? (
        <PlantDetails plant={plant} catalog={plants.data} />
      ) : (
        <EmptyState icon={SearchX} title={t('detail.notFound')}>
          {t('detail.notFoundText')}
        </EmptyState>
      )}
    </>
  );
}

/** Shape of the detail page while the catalogue loads. */
function PlantDetailSkeleton() {
  const { t } = useTranslation('catalog');
  return (
    <div className="flex flex-col gap-6" aria-busy="true" role="status">
      <span className="sr-only">{t('detail.loading')}</span>
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// Params are untyped here: typing them via the route would make router.tsx circular.
function plantIdParam(params: unknown): string {
  const value = (params as { plantId?: unknown } | null)?.plantId;
  return typeof value === 'string' ? value : '';
}

function PlantDetails({
  plant,
  catalog,
}: {
  plant: CatalogPlant;
  catalog: readonly CatalogPlant[];
}) {
  const { t } = useTranslation('catalog');
  const { language } = useLanguage();
  const [adjusting, setAdjusting] = useState(false);
  const reset = useAdjustPlant(plant.id);
  const changed = changedFields(plant);
  const { global } = plant;

  /** One value; adjusted ones show the global value next to them. */
  const row = (key: keyof PlantFields, label: string, value: ReactNode, standard?: string) => {
    const isChanged = changed.has(key);
    return (
      <div
        key={key}
        className={cn(
          'flex flex-col gap-0.5 rounded-lg border px-3 py-2',
          isChanged && 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40',
        )}
        data-changed={isChanged || undefined}
      >
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="font-medium">
          {value}
          {isChanged && standard !== undefined && (
            <span className="ml-2 text-xs font-normal text-amber-900 dark:text-amber-200">
              {t('detail.adjusted', { value: standard })}
            </span>
          )}
        </dd>
      </div>
    );
  };

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <PlantIcon plant={plant} size={64} decorative />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {plantName(plant, language)}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {t(`category.${plant.category}`)} · {familyName(plant, language)}
            </span>
            <SourceBadge plant={plant} />
          </div>
        </div>
        {plant.source === 'GLOBAL' && (
          <div className="flex basis-full flex-wrap gap-2 sm:basis-auto">
            <Button
              variant="outline"
              className="h-11 md:h-9"
              onClick={() => {
                setAdjusting(true);
              }}
            >
              <SlidersHorizontal aria-hidden />
              {t('detail.adjust')}
            </Button>
            {plant.overridden && (
              <Button
                variant="outline"
                className="h-11 md:h-9"
                disabled={reset.isPending}
                onClick={() => {
                  reset.mutate(null);
                }}
              >
                <RotateCcw aria-hidden />
                {t('detail.reset')}
              </Button>
            )}
          </div>
        )}
        {plant.source === 'OWN' && (
          <Button asChild variant="outline" className="h-11 basis-full sm:basis-auto md:h-9">
            <Link to="/katalog/$plantId/bearbeiten" params={{ plantId: plant.id }}>
              <Pencil aria-hidden />
              {t('detail.edit')}
            </Link>
          </Button>
        )}
      </header>
      {reset.isError && <FormMessage tone="error">{apiErrorMessage(reset.error)}</FormMessage>}

      {plant.source === 'OWN' && <PublicationPanel plant={plant} catalog={catalog} />}

      <section aria-labelledby="plant-values" className="flex flex-col gap-2">
        <h2 id="plant-values" className="text-lg font-semibold">
          {t('detail.values')}
        </h2>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {row(
            'category',
            t('detail.category'),
            t(`category.${plant.category}`),
            global && t(`category.${global.category}`),
          )}
          {row(
            'family',
            t('detail.family'),
            familyName(plant, language),
            global && familyName(global, language),
          )}
          {row(
            'feeder',
            t('detail.feeder'),
            t(`feeder.${plant.feeder}`),
            global && t(`feeder.${global.feeder}`),
          )}
          {row(
            'spacingInRowCm',
            t('detail.spacingInRow'),
            t('detail.cm', { value: plant.spacingInRowCm }),
            global && t('detail.cm', { value: global.spacingInRowCm }),
          )}
          {row(
            'rowSpacingCm',
            t('detail.rowSpacing'),
            t('detail.cm', { value: plant.rowSpacingCm }),
            global && t('detail.cm', { value: global.rowSpacingCm }),
          )}
          {row(
            'lifecycle',
            t('detail.lifecycle'),
            lifecycleText(plant.lifecycle, language),
            global && lifecycleText(global.lifecycle, language),
          )}
          {row(
            'frostSensitive',
            t('detail.frostSensitive'),
            plant.frostSensitive ? t('detail.yes') : t('detail.no'),
            global && (global.frostSensitive ? t('detail.yes') : t('detail.no')),
          )}
          {row(
            'sowing',
            t('detail.sowing'),
            plant.sowing ? (
              <ul className="flex flex-col gap-0.5">
                {sowingLines(plant.sowing, language).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              t('detail.noDetails')
            ),
            global &&
              (global.sowing
                ? sowingLines(global.sowing, language).join(', ')
                : t('detail.noDetailsStandard')),
          )}
          {row(
            'color',
            t('detail.color'),
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="size-4 rounded-sm border"
                style={{ backgroundColor: plant.color }}
              />
              {plant.color}
            </span>,
            global?.color,
          )}
        </dl>
      </section>

      <SowingCalendar plant={plant} />

      <Neighbors
        title={t('detail.goodNeighbors')}
        ids={plant.goodNeighbors}
        catalog={catalog}
        tone="good"
        empty={t('detail.noGoodNeighbors')}
      />
      <Neighbors
        title={t('detail.badNeighbors')}
        ids={plant.badNeighbors}
        catalog={catalog}
        tone="bad"
        empty={t('detail.noBadNeighbors')}
      />

      <AdjustPlantDialog plant={plant} open={adjusting} onOpenChange={setAdjusting} />
    </article>
  );
}

function Neighbors({
  title,
  ids,
  catalog,
  tone,
  empty,
}: {
  title: string;
  ids: readonly string[];
  catalog: readonly CatalogPlant[];
  tone: 'good' | 'bad';
  empty: string;
}) {
  const { language } = useLanguage();
  const neighbors = ids
    .flatMap((id) => catalog.find((p) => p.id === id) ?? [])
    .sort(byPlantName(language));
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {neighbors.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={title}>
          {neighbors.map((neighbor) => (
            <li key={neighbor.id}>
              <Link
                to="/katalog/$plantId"
                params={{ plantId: neighbor.id }}
                className={cn(
                  'focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm outline-none focus-visible:ring-[3px] md:min-h-9',
                  tone === 'good'
                    ? 'border-green-300 bg-green-50 text-green-900 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200'
                    : 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
                )}
              >
                <PlantIcon plant={neighbor} size={28} decorative />
                {plantName(neighbor, language)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import type { CatalogPlant, PlantFields } from '@hochbeet/contracts';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Pencil, RotateCcw, SearchX, SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { AdjustPlantDialog } from '@/components/catalog/AdjustPlantDialog';
import { PublicationPanel } from '@/components/catalog/PublicationPanel';
import { SourceBadge } from '@/components/catalog/SourceBadge';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/api';
import { CATEGORY_LABEL, changedFields, FEEDER_LABEL, lifecycleText } from '@/lib/catalog';
import { useAdjustPlant, usePlants } from '@/lib/garden';
import { cn } from '@/lib/utils';

/** Route component for /katalog/$plantId. */
export function PlantDetailPage() {
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
        Katalog
      </Link>
      {plants.isError ? (
        <FormMessage tone="error">
          Der Katalog konnte nicht geladen werden. Bitte lade die Seite neu.
        </FormMessage>
      ) : plants.isPending ? (
        <p className="text-muted-foreground text-sm">Sorte wird geladen …</p>
      ) : plant ? (
        <PlantDetails plant={plant} catalog={plants.data} />
      ) : (
        <EmptyState icon={SearchX} title="Sorte nicht gefunden">
          Diese Sorte gibt es nicht oder nicht mehr in deinem Katalog.
        </EmptyState>
      )}
    </>
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
              angepasst (Standard: {standard})
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
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{plant.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {CATEGORY_LABEL[plant.category]} · {plant.family}
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
              Für mich anpassen
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
                Zurücksetzen
              </Button>
            )}
          </div>
        )}
        {plant.source === 'OWN' && (
          <Button asChild variant="outline" className="h-11 basis-full sm:basis-auto md:h-9">
            <Link to="/katalog/$plantId/bearbeiten" params={{ plantId: plant.id }}>
              <Pencil aria-hidden />
              Bearbeiten
            </Link>
          </Button>
        )}
      </header>
      {reset.isError && <FormMessage tone="error">{apiErrorMessage(reset.error)}</FormMessage>}

      {plant.source === 'OWN' && <PublicationPanel plant={plant} catalog={catalog} />}

      <section aria-labelledby="plant-values" className="flex flex-col gap-2">
        <h2 id="plant-values" className="text-lg font-semibold">
          Werte
        </h2>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {row(
            'category',
            'Kategorie',
            CATEGORY_LABEL[plant.category],
            global && CATEGORY_LABEL[global.category],
          )}
          {row('family', 'Familie', plant.family, global?.family)}
          {row(
            'feeder',
            'Bedarf',
            FEEDER_LABEL[plant.feeder],
            global && FEEDER_LABEL[global.feeder],
          )}
          {row(
            'spacingInRowCm',
            'Abstand in der Reihe',
            `${String(plant.spacingInRowCm)} cm`,
            global && `${String(global.spacingInRowCm)} cm`,
          )}
          {row(
            'rowSpacingCm',
            'Reihenabstand',
            `${String(plant.rowSpacingCm)} cm`,
            global && `${String(global.rowSpacingCm)} cm`,
          )}
          {row(
            'lifecycle',
            'Standzeit',
            lifecycleText(plant.lifecycle),
            global && lifecycleText(global.lifecycle),
          )}
          {row(
            'color',
            'Farbe im Beet',
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

      <Neighbors
        title="Gute Nachbarn"
        ids={plant.goodNeighbors}
        catalog={catalog}
        tone="good"
        empty="Keine bekannten guten Nachbarn."
      />
      <Neighbors
        title="Schlechte Nachbarn"
        ids={plant.badNeighbors}
        catalog={catalog}
        tone="bad"
        empty="Keine bekannten schlechten Nachbarn."
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
  const neighbors = ids
    .flatMap((id) => catalog.find((p) => p.id === id) ?? [])
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
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
                {neighbor.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

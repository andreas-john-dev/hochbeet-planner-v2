import { PlantIcon } from '@hochbeet/plant-icons/react';
import { Link } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Inbox, Plus, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonList } from '@/components/ui/skeleton';
import { FEEDER_LABEL, filterCatalog, NO_FILTER } from '@/lib/catalog';
import { usePlants, usePublicationQueue } from '@/lib/garden';

const rowClass =
  'bg-card hover:bg-accent focus-visible:ring-ring/50 flex min-h-14 items-center gap-3 rounded-xl border p-3 outline-none focus-visible:ring-[3px]';

/** Admin start page: the publication queue and the global plants. */
export function AdminPage() {
  return (
    <>
      <PageHeader
        title="Administration"
        description="Publikationsanfragen prüfen und globale Sorten pflegen."
      />
      <div className="flex flex-col gap-10">
        <Queue />
        <GlobalPlants />
      </div>
    </>
  );
}

function Queue() {
  const queue = usePublicationQueue();
  const requests = queue.data ?? [];
  return (
    <section aria-labelledby="queue" className="flex flex-col gap-3">
      <h2 id="queue" className="text-lg font-semibold">
        Warteschlange
        {requests.length > 0 && (
          <span className="text-muted-foreground ml-2 text-sm font-normal">
            {requests.length} {requests.length === 1 ? 'Anfrage' : 'Anfragen'}
          </span>
        )}
      </h2>
      {queue.isError ? (
        <FormMessage tone="error">Die Warteschlange konnte nicht geladen werden.</FormMessage>
      ) : queue.isPending ? (
        <SkeletonList
          label="Warteschlange wird geladen …"
          count={2}
          className="grid gap-2 sm:grid-cols-2"
          itemClassName="h-14 rounded-xl"
        />
      ) : requests.length === 0 ? (
        <EmptyState icon={Inbox} title="Keine offenen Anfragen">
          Schlägt jemand eine eigene Sorte für alle vor, erscheint sie hier.
        </EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Anfragen">
          {requests.map(({ plant, requestedAt }) => (
            <li key={plant.id}>
              <Link
                to="/admin/anfragen/$plantId"
                params={{ plantId: plant.id }}
                className={rowClass}
              >
                <PlantIcon plant={plant} size={40} decorative />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{plant.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {plant.family} · angefragt am{' '}
                    {requestedAt
                      ? format(parseISO(requestedAt), 'd. MMMM yyyy', { locale: de })
                      : '–'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GlobalPlants() {
  const plants = usePlants();
  const [query, setQuery] = useState('');
  const searchId = useId();
  const globals = filterCatalog(
    (plants.data ?? []).filter((p) => p.source === 'GLOBAL'),
    { ...NO_FILTER, query },
  );
  return (
    <section aria-labelledby="global-plants" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="global-plants" className="text-lg font-semibold">
          Globale Sorten
        </h2>
        <Button asChild className="h-11 md:h-10">
          <Link to="/admin/sorten/neu">
            <Plus aria-hidden />
            Globale Sorte anlegen
          </Link>
        </Button>
      </div>
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Globale Sorten suchen
        </label>
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          id={searchId}
          type="search"
          placeholder="Sorte oder Familie suchen"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className="pl-9"
        />
      </div>
      {plants.isError ? (
        <FormMessage tone="error">Der Katalog konnte nicht geladen werden.</FormMessage>
      ) : plants.isPending ? (
        <SkeletonList label="Globale Sorten werden geladen …" itemClassName="h-14 rounded-xl" />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Globale Sorten">
          {globals.map((plant) => (
            <li key={plant.id}>
              <Link to="/admin/sorten/$plantId" params={{ plantId: plant.id }} className={rowClass}>
                <PlantIcon plant={plant} size={32} decorative />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{plant.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {plant.family} · {FEEDER_LABEL[plant.feeder]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { PlantIcon } from '@hochbeet/plant-icons/react';
import { Link } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import { Inbox, Plus, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonList } from '@/components/ui/skeleton';
import { filterCatalog, NO_FILTER } from '@/lib/catalog';
import { usePlants, usePublicationQueue } from '@/lib/garden';
import { useDateLocale } from '@/lib/i18n';

const rowClass =
  'bg-card hover:bg-accent focus-visible:ring-ring/50 flex min-h-14 items-center gap-3 rounded-xl border p-3 outline-none focus-visible:ring-[3px]';

/** Admin start page: the publication queue and the global plants. */
export function AdminPage() {
  const { t } = useTranslation('admin');
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="flex flex-col gap-10">
        <Queue />
        <GlobalPlants />
      </div>
    </>
  );
}

function Queue() {
  const { t } = useTranslation('admin');
  const locale = useDateLocale();
  const queue = usePublicationQueue();
  const requests = queue.data ?? [];
  return (
    <section aria-labelledby="queue" className="flex flex-col gap-3">
      <h2 id="queue" className="text-lg font-semibold">
        {t('queue.title')}
        {requests.length > 0 && (
          <span className="text-muted-foreground ml-2 text-sm font-normal">
            {t('queue.count', { count: requests.length })}
          </span>
        )}
      </h2>
      {queue.isError ? (
        <FormMessage tone="error">{t('queue.loadError')}</FormMessage>
      ) : queue.isPending ? (
        <SkeletonList
          label={t('queue.loading')}
          count={2}
          className="grid gap-2 sm:grid-cols-2"
          itemClassName="h-14 rounded-xl"
        />
      ) : requests.length === 0 ? (
        <EmptyState icon={Inbox} title={t('queue.empty')}>
          {t('queue.emptyText')}
        </EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label={t('queue.requests')}>
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
                    {t('queue.requestedOn', {
                      family: plant.family,
                      date: requestedAt ? format(parseISO(requestedAt), 'PPP', { locale }) : '–',
                    })}
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
  const { t } = useTranslation(['admin', 'catalog']);
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
          {t('globals.title')}
        </h2>
        <Button asChild className="h-11 md:h-10">
          <Link to="/admin/sorten/neu">
            <Plus aria-hidden />
            {t('globals.create')}
          </Link>
        </Button>
      </div>
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          {t('globals.search')}
        </label>
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          id={searchId}
          type="search"
          placeholder={t('catalog:list.search')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className="pl-9"
        />
      </div>
      {plants.isError ? (
        <FormMessage tone="error">{t('globals.loadError')}</FormMessage>
      ) : plants.isPending ? (
        <SkeletonList label={t('globals.loading')} itemClassName="h-14 rounded-xl" />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('globals.title')}>
          {globals.map((plant) => (
            <li key={plant.id}>
              <Link to="/admin/sorten/$plantId" params={{ plantId: plant.id }} className={rowClass}>
                <PlantIcon plant={plant} size={32} decorative />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{plant.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {plant.family} · {t(`catalog:feeder.${plant.feeder}`)}
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

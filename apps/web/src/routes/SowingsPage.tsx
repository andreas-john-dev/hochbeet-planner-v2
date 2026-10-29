import { Link } from '@tanstack/react-router';
import { Bean, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { SowingCard } from '@/components/sowings/SowingCard';
import { SowingFormDialog } from '@/components/sowings/SowingFormDialog';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api';
import { usePlants, useSowings } from '@/lib/garden';
import { filterSowings, groupByYear, SOWING_FILTERS, type SowingFilter } from '@/lib/sowings';
import { cn } from '@/lib/utils';

const EMPTY_FILTER: Record<SowingFilter, string> = {
  active: 'Gerade läuft keine Anzucht.',
  done: 'Noch keine Anzucht abgeschlossen.',
  all: '',
};

/**
 * „Anzucht“: all sowing batches by year and sowing week, with their stage and stock, and
 * how many seedlings are already planned into beds.
 */
export function SowingsPage() {
  const sowings = useSowings();
  const plants = usePlants();
  const [filter, setFilter] = useState<SowingFilter>('active');
  const [creating, setCreating] = useState(false);
  const openCreate = () => {
    setCreating(true);
  };
  const all = sowings.data ?? [];
  const groups = groupByYear(filterSowings(all, filter));
  const pending = sowings.isPending || plants.isPending;
  const error = sowings.error ?? plants.error;

  return (
    <>
      <PageHeader
        title="Anzucht"
        description="Was du vorziehst, von der Saat bis ins Beet, mit dem Bestand an Jungpflanzen."
      >
        {all.length > 0 && (
          <Button onClick={openCreate}>
            <Plus aria-hidden />
            Neue Anzucht
          </Button>
        )}
      </PageHeader>

      {pending && !error && <SkeletonList label="Anzuchten werden geladen …" count={4} />}
      {error && <FormMessage tone="error">{apiErrorMessage(error)}</FormMessage>}

      {!pending && !error && all.length === 0 && (
        <div className="flex flex-col items-center gap-4">
          <EmptyState icon={Bean} title="Noch keine Anzuchten">
            Halte fest, was du auf der Fensterbank vorziehst: Sorte, Aussaatwoche, Menge und
            Bestand. Wann sich eine Sorte vorziehen lässt, zeigt ihr Aussaatkalender im{' '}
            <Link
              to="/katalog"
              className="text-foreground font-medium underline underline-offset-4"
            >
              Katalog
            </Link>
            .
          </EmptyState>
          <Button onClick={openCreate}>
            <Plus aria-hidden />
            Erste Anzucht anlegen
          </Button>
        </div>
      )}

      {!pending && !error && all.length > 0 && plants.data && (
        <div className="flex flex-col gap-6">
          <div
            role="group"
            aria-label="Anzuchten zeigen"
            className="bg-muted flex w-fit gap-1 rounded-lg p-1"
          >
            {SOWING_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                }}
                className={cn(
                  'focus-visible:ring-ring/50 h-11 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] md:h-9',
                  filter === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {groups.length === 0 && (
            <p className="text-muted-foreground text-sm">{EMPTY_FILTER[filter]}</p>
          )}
          {groups.map(({ year, sowings: list }) => (
            <section
              key={year}
              aria-labelledby={`sowings-${String(year)}`}
              className="flex flex-col gap-3"
            >
              <h2 id={`sowings-${String(year)}`} className="text-lg font-semibold">
                {year}
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {list.map((item) => (
                  <SowingCard key={item.sowing.id} item={item} plants={plants.data} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {creating && <SowingFormDialog plants={plants.data ?? []} open onOpenChange={setCreating} />}
    </>
  );
}

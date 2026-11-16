import { evaluateSowings, type SowingFinding } from '@hochbeet/garden-rules';
import { Link } from '@tanstack/react-router';
import { Bean, ListChecks, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { SowingCard } from '@/components/sowings/SowingCard';
import { SowingFormDialog } from '@/components/sowings/SowingFormDialog';
import { SowingPlanDialog } from '@/components/sowings/SowingPlanDialog';
import { WeeklyTasksCard } from '@/components/sowings/WeeklyTasksCard';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api';
import { useGardenSettings, usePlants, useSowings } from '@/lib/garden';
import { useLanguage } from '@/lib/i18n';
import { plantName } from '@/lib/plant-names';
import { filterSowings, groupByYear, SOWING_FILTERS, type SowingFilter } from '@/lib/sowings';
import { cn } from '@/lib/utils';

/**
 * „Anzucht“: all sowing batches by year and sowing week, with their stage and stock, and
 * how many seedlings are already planned into beds.
 */
export function SowingsPage() {
  const { t } = useTranslation('sowings');
  const sowings = useSowings();
  const plants = usePlants();
  const [filter, setFilter] = useState<SowingFilter>('active');
  const [creating, setCreating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const openCreate = () => {
    setCreating(true);
  };
  const lastFrost = useGardenSettings().data?.lastFrost;
  const { language } = useLanguage();
  const all = useMemo(() => sowings.data ?? [], [sowings.data]);
  // Findings about the batches, never stored: raising window, direct sowing, stock, frost.
  const findings = useMemo(() => {
    const byBatch = new Map<string, SowingFinding[]>();
    const list = evaluateSowings(all, plants.data ?? [], {
      locale: language,
      plantName: (plant) => plantName(plant, language),
      ...(lastFrost ? { lastFrost } : {}),
    });
    for (const finding of list) {
      byBatch.set(finding.sowingId, [...(byBatch.get(finding.sowingId) ?? []), finding]);
    }
    return byBatch;
  }, [all, plants.data, lastFrost, language]);
  const groups = groupByYear(filterSowings(all, filter));
  const pending = sowings.isPending || plants.isPending;
  const error = sowings.error ?? plants.error;

  return (
    <>
      <PageHeader title={t('title')} description={t('description')}>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPlanning(true);
            }}
          >
            <ListChecks aria-hidden />
            {t('plan')}
          </Button>
          {all.length > 0 && (
            <Button onClick={openCreate}>
              <Plus aria-hidden />
              {t('create')}
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="mb-6">
        <WeeklyTasksCard />
      </div>

      {pending && !error && <SkeletonList label={t('loading')} count={4} />}
      {error && <FormMessage tone="error">{apiErrorMessage(error)}</FormMessage>}

      {!pending && !error && all.length === 0 && (
        <div className="flex flex-col items-center gap-4">
          <EmptyState icon={Bean} title={t('empty.title')}>
            <Trans
              t={t}
              i18nKey="empty.text"
              components={{
                catalog: (
                  <Link
                    to="/katalog"
                    className="text-foreground font-medium underline underline-offset-4"
                  />
                ),
              }}
            />
          </EmptyState>
          <Button onClick={openCreate}>
            <Plus aria-hidden />
            {t('createFirst')}
          </Button>
        </div>
      )}

      {!pending && !error && all.length > 0 && plants.data && (
        <div className="flex flex-col gap-6">
          <div
            role="group"
            aria-label={t('filter.label')}
            className="bg-muted flex w-fit gap-1 rounded-lg p-1"
          >
            {SOWING_FILTERS.map((value) => (
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
                {t(`filter.${value}`)}
              </button>
            ))}
          </div>

          {groups.length === 0 && filter !== 'all' && (
            <p className="text-muted-foreground text-sm">
              {filter === 'done' ? t('filter.emptyDone') : t('filter.emptyActive')}
            </p>
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
                  <SowingCard
                    key={item.sowing.id}
                    item={item}
                    plants={plants.data}
                    findings={findings.get(item.sowing.id) ?? []}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <SowingPlanDialog open={planning} onOpenChange={setPlanning} />
      {creating && <SowingFormDialog plants={plants.data ?? []} open onOpenChange={setCreating} />}
    </>
  );
}

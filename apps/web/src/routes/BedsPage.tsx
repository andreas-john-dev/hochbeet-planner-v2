import { formatWeek } from '@hochbeet/garden-rules';
import { CalendarDays, ListChecks, Plus, Sprout } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BedCard } from '@/components/beds/BedCard';
import { BedFormDialog } from '@/components/beds/BedFormDialog';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { SowingPlanDialog } from '@/components/sowings/SowingPlanDialog';
import { WeeklyTasksCard } from '@/components/sowings/WeeklyTasksCard';
import { Button } from '@/components/ui/button';
import { useBeds } from '@/lib/garden';
import { useLanguage } from '@/lib/i18n';

export function BedsPage() {
  const { t } = useTranslation('beds');
  const [today] = useState(() => new Date());
  const { language } = useLanguage();
  const { range, week } = formatWeek(today, language);
  const beds = useBeds();
  const [creating, setCreating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const openCreate = () => {
    setCreating(true);
  };

  return (
    <>
      <PageHeader title={t('title')} description={t('description')}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="bg-card flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
            <CalendarDays className="text-primary size-4" aria-hidden />
            <span className="font-medium">{range}</span>
            <span className="text-muted-foreground text-xs">{week}</span>
          </p>
          {beds.data && beds.data.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setPlanning(true);
                }}
              >
                <ListChecks aria-hidden />
                {t('sowingPlan')}
              </Button>
              <Button onClick={openCreate}>
                <Plus aria-hidden />
                {t('create')}
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {beds.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-muted h-56 animate-pulse rounded-xl" />
          ))}
          <span className="sr-only">{t('loading')}</span>
        </div>
      )}

      {beds.isError && <FormMessage tone="error">{t('loadError')}</FormMessage>}

      {beds.data?.length === 0 && (
        <div className="flex flex-col items-center gap-4">
          <EmptyState icon={Sprout} title={t('empty.title')}>
            {t('empty.text')}
          </EmptyState>
          <Button onClick={openCreate}>
            <Plus aria-hidden />
            {t('createFirst')}
          </Button>
        </div>
      )}

      {beds.data && beds.data.length > 0 && (
        <div className="mb-6">
          <WeeklyTasksCard compact />
        </div>
      )}

      {beds.data && beds.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {beds.data.map((bed) => (
            <BedCard key={bed.id} bed={bed} today={today} />
          ))}
        </div>
      )}

      <BedFormDialog open={creating} onOpenChange={setCreating} />
      <SowingPlanDialog open={planning} onOpenChange={setPlanning} />
    </>
  );
}

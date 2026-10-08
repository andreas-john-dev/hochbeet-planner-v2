import { formatWeek } from '@hochbeet/garden-rules';
import { CalendarDays, Plus, Sprout } from 'lucide-react';
import { useState } from 'react';
import { BedCard } from '@/components/beds/BedCard';
import { BedFormDialog } from '@/components/beds/BedFormDialog';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useBeds } from '@/lib/garden';

export function BedsPage() {
  const [today] = useState(() => new Date());
  const { range, week } = formatWeek(today);
  const beds = useBeds();
  const [creating, setCreating] = useState(false);
  const openCreate = () => {
    setCreating(true);
  };

  return (
    <>
      <PageHeader title="Meine Beete" description="Plane deine Hochbeete Woche für Woche.">
        <div className="flex flex-wrap items-center gap-3">
          <p className="bg-card flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
            <CalendarDays className="text-primary size-4" aria-hidden />
            <span className="font-medium">{range}</span>
            <span className="text-muted-foreground text-xs">{week}</span>
          </p>
          {beds.data && beds.data.length > 0 && (
            <Button onClick={openCreate}>
              <Plus aria-hidden />
              Beet anlegen
            </Button>
          )}
        </div>
      </PageHeader>

      {beds.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-muted h-56 animate-pulse rounded-xl" />
          ))}
          <span className="sr-only">Beete werden geladen …</span>
        </div>
      )}

      {beds.isError && (
        <FormMessage tone="error">
          Deine Beete konnten nicht geladen werden. Bitte lade die Seite neu.
        </FormMessage>
      )}

      {beds.data?.length === 0 && (
        <div className="flex flex-col items-center gap-4">
          <EmptyState icon={Sprout} title="Noch keine Beete">
            Leg dein erstes Hochbeet an. Danach setzt du Pflanzen und siehst Hinweise zu Abstand,
            Nachbarn und Fruchtfolge.
          </EmptyState>
          <Button onClick={openCreate}>
            <Plus aria-hidden />
            Erstes Beet anlegen
          </Button>
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
    </>
  );
}

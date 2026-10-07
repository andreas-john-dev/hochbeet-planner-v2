import { CalendarDays, Sprout } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatWeek } from '@hochbeet/garden-rules';

export function BedsPage() {
  const { range, week } = formatWeek(new Date());

  return (
    <>
      <PageHeader title="Meine Beete" description="Plane deine Hochbeete Woche für Woche.">
        <p className="bg-card flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
          <CalendarDays className="text-primary size-4" aria-hidden />
          <span className="font-medium">{range}</span>
          <span className="text-muted-foreground text-xs">{week}</span>
        </p>
      </PageHeader>
      <EmptyState icon={Sprout} title="Noch keine Beete">
        Hier erscheinen deine Hochbeete mit allen Pflanzungen und Hinweisen zu Abstand, Nachbarn und
        Fruchtfolge.
      </EmptyState>
    </>
  );
}
